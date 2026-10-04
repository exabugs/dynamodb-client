# メディア（ファイルアップロード/配信）機能 設計書

本書は`@exabugs/dynamodb-client`が提供するメディア機能の設計書。**アプリ固有名詞を一切含まない**（呼び出し側アプリの統合手順・固有のメタデータ・権限モデルは、呼び出し側アプリのリポジトリのドキュメントに記載する）。

## 目的・スコープ

サーバーレスアプリの基盤機能として、ファイルのアップロード・処理・配信を提供する。**画像専用を前提にしない**。コア機能（presign発行・S3直接転送・DynamoDBでの状態管理・CDN配信）はファイル種別を問わない汎用実装とし、画像処理（sharp）は`contentType`が`image/*`の場合にのみ動作するオプション機能とする。

**設計原則（重要）**: 「誰が・何を・アップロード/閲覧して良いか」という認可判断は、このライブラリは一切持たない。判断は常に呼び出し側アプリのビジネスロジックに委ねる。ライブラリは「有効なリクエストになら処理する/署名する/検証する」という機構だけを提供する。特定の利用アプリ向けの値をハードコードしない。

**構成パラメータの管理場所は「本当にインフラ設定か」で使い分ける**: S3 Lifecycleの期間のようにAWSリソースの設定そのものはTerraform変数で構成可能にする。一方、**許容する画像幅・masterの最大寸法・許可contentType等は「呼び出し側アプリの運用判断（UIがどのサイズを必要とするか等）」であり、変更のたびにTerraform apply（インフラデプロイ）を要求するのは不適切**。これらは署名鍵と同じパターン（実行時にParameter Store等から取得、Terraformが管理するのはパラメータの「名前」だけ）にし、値自体はインフラデプロイなしで更新できるようにする（詳細は後述）。

## 設計方針1: 呼び出し側の既存テーブルに相乗りする

このライブラリは専用テーブルを持たない。呼び出し側アプリが既に持っているDynamoDBテーブル（Single-Table設計）に、`media`という1リソースとして相乗りする。テーブル名・ARNは呼び出し側がTerraform変数（`table_name`・`table_arn`）で渡す。

Single-Table設計でPKがリソース名になっている実装であれば、新しいPK値を追加しても既存リソースのCRUD・Shadow Records生成に干渉しない想定だが、**呼び出し側は自身の型推論・リソース横断ロジックに副作用がないことを実装時に確認すること**。

個別取得・一覧取得は呼び出し側の既存の認可レイヤー（`AuthorizedRepository`等、権限マトリクス方式で権限チェックを行う機構）にそのまま乗せることを推奨する。

## 設計方針2: presign発行時点ではDynamoDBに触れない

**当初案（presign時に`pending`レコードを作成する）は以下の理由で撤回した**:

- テーブル名を実行時に注入する設計にすると、内部の`insertOne`等の操作の既存実装（環境変数からテーブル名を解決する実装）と整合しない
- TTLが日単位でしか設定できない実装だと、「`pending`放置レコードの自動削除」を分単位等の粒度で実現できない
- 呼び出し側がDynamoDBに直接書き込む設計は、呼び出し側自身のアーキテクチャ規約（Handler→Service→Repositoryのような層構造）をバイパスしうる

**方式**: presign発行はS3署名の発行のみを行い、DynamoDBには一切触れない。

1. presign発行時、S3 Presigned POSTのpolicy（conditions）に、メタデータフィールドを**`eq`条件で固定**して埋め込む。これにより、クライアントは自分の認証情報から導かれた値以外をアップロード時に指定できない（署名の一部なので改ざん不可）。
2. クライアントはS3へ直接アップロード（この時点でDynamoDBレコードは存在しない）。
3. S3 `ObjectCreated`イベントで`process-handler`が起動し、**アップロードされたS3オブジェクトのメタデータ（署名済みで信頼できる）を読み取って初めてDynamoDBレコードを作成する**（`updateOne`＋`upsert:true`）。
4. クライアント側のポーリングは「レコードが0件＝処理中」「`status:'completed'`＝完了」「`status:'failed'`＝失敗」の3値判定にする。

これにより、**TTLによる`pending`放置対策も、呼び出し側のDynamoDB書き込み権限も一切不要になる**（アップロードされなかった/失敗したファイルはDynamoDBに痕跡を残さない）。

### presigned POSTの再利用・master不変性について（2026-10-05改訂。設計レビューで指摘されたCritical事項への対応）

presigned POSTは、発行してから有効期限が切れるまでの間、**同一の署名付きpolicyで何度でもPOSTできる**（S3 presigned POSTの仕様であり、本ライブラリが制御できるものではない）。そのため理論上、クライアントが期限内に同じ`fileId`（＝同じ`raw/{fileId}`キー）へ2回目のPOSTを行うと、`process-handler`が再度起動し、`master/{fileId}`が新しいアップロード内容で上書きされる。

- **Keyはeq条件で固定**: `createPresignedPost`の`Key`パラメータに具体的なfileIdを渡すことで、S3側は暗黙にこの値への`eq`条件を課す（`starts-with`等のプレフィックス一致ではない）。そのため、クライアントが**他人のfileId宛てに**このpresignedPOSTを流用することはできない（Keyは発行時に固定された1つの値のみ受け付ける）。
- **残存リスク**: 同一fileId（＝自分がpresignを要求して払い出された、自分の所有物であるはずのfileId）に対して、有効期限内に複数回アップロードし直すことは技術的に可能であり、ライブラリはこれを禁止する手段を持たない（ADR記載の通り、本体の`updateOne`に条件付き書き込みが無いため、「1回目の処理が完了していたら2回目を拒否する」という排他制御も実装できない）。
- **許容する理由**: fileIdは常に呼び出し側の認可済みフロー（presign発行時に権限チェック済み）経由でしか払い出されず、**他のユーザーのデータを上書きする経路にはならない**（影響範囲は常に「自分が今アップロードしようとしている1件」に閉じる）。したがって、これはクロステナントのセキュリティ問題ではなく、「短い時間内に同じアップロードをやり直すと内容が後勝ちになる」という程度の、限定的なデータ整合性の残存リスクとして許容する。
- **TTLの長さは実のところこのリスクの主な軽減策ではない**: 当初「TTLを短くすれば再利用の時間窓が狭まる」としていたが、検討の結果、このリスクへの実質的な対策はTTLの長さではなく、(1) `fileId`が発行のたびに一意（ULID）であること、(2) `content-length-range`・`Content-Type`のpolicy条件、(3) アップロード後の`process-handler`によるサーバー側検証（マジックナンバー照合）の3点であり、いずれも実装済みである。TTLを極端に短くしても、このリスク自体はほとんど縮小しない。
- **TTL（`expiresInSeconds`）の既定値は30秒**: この値は上記の再利用リスク対策としてではなく、**「presignを受け取ってから実際にS3へのPOSTを開始するまでに正当にかかり得る時間」**（ネットワーク往復、悪条件下でのDNS/TCP/TLSハンドシェイクを含めても数秒〜10秒程度）を安全にカバーするための値として設定する（算出根拠は「設計方針2」のpresign発行タイミングの前提を参照）。presignは呼び出し側がアップロードを開始する直前に発行する設計を前提としており（事前に先回りして取得・保持するものではない）、ファイル転送そのものの所要時間はTTLに含める必要がない（S3はpresigned POSTのpolicy expirationをリクエスト開始時点で判定し、転送開始後に期限が切れても転送自体は継続すると推定される。presigned URL（GET/PUT）については[AWS公式ドキュメント](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)に明記されている挙動だが、POSTについても同様と推定されるため、本番投入前に実機で確認すること）。
- **失敗時は必ず新しいpresignを取り直す**: ネットワークエラー・期限切れ等、理由を問わず、同じpresignでの再試行はしない設計とする。これによりTTLの長さをリトライ回数・間隔から独立させ、設計をシンプルに保てる。
- 将来、本体に条件付き書き込みが追加された場合は、`process-handler`が「既に`completed`なら無視する」という冪等性チェックを追加することを検討する。

## 設計方針3: presign発行のメタデータは汎用マップで受け取る

`generatePresignedUpload`は個別引数（例: owner・カテゴリ等）ではなく、汎用`metadata: Record<string, string>`で受け取る。呼び出し側が自由に渡すアプリ固有フィールド（所有者ID・カテゴリ・紐付け先エンティティのID等）をそのまま`x-amz-meta-{key}`としてpolicyの`eq`条件に固定する。これにより、アプリ固有の語彙がライブラリ本体に漏れ出さない。

### メタデータの契約（2026-10-05改訂。設計レビューで指摘されたCritical事項への対応）

初版の設計には、S3のユーザー定義メタデータが実際にどう扱われるかという前提（AWSの仕様に起因する制約）が明記されておらず、実装段階で以下の問題が発覚した: S3はメタデータの**キーを常に小文字化して保存する**。そのため`{ ownerId: 'user-1' }`のようなキャメルケースのキーで`x-amz-meta-ownerId`を固定しても、`process-handler`がHeadObjectで読み戻す時には`ownerid`という別のキーになり、呼び出し側の権限スコープ判定（例: `ownerId`でのフィルタ）がサイレントに失敗する。この契約を以下の通り明文化する。

- **キー形式**: `generatePresignedUpload`は、`metadata`の各キーが`^[a-z0-9-]+$`（小文字英数字とハイフンのみ）に一致することを検証し、一致しなければ即座に例外を投げる（S3によるキー変換を前提に、呼び出し側のキー設計ミスを実装時に早期検出するため）。呼び出し側は最初から小文字・ハイフン区切り（例: `owner-id`）でキーを渡すこと。
- **予約キーとの衝突**: `metadata`のキーが`MediaRecord`の共通フィールド名（`id`・`status`・`contentType`・`outputContentType`・`originalFilename`・`dimensions`・`size`・`error`・`createdAt`・`updatedAt`）と一致する場合も拒否する。「アプリ固有の追加フィールドをそのまま書き込む」という設計（方針3・コンポーネント一覧参照）は、呼び出し側のキーがライブラリの予約フィールドを上書きしないことを前提にしているため。
- **値の文字種**: S3のユーザー定義メタデータ値はUS-ASCIIのみ有効。非ASCII文字（例: 日本語の表示名）を値として渡す必要がある場合、呼び出し側がpercent-encoding等で事前にエンコードし、`process-handler`の読み取り結果をデコードして使うこと（ライブラリはこのエンコード/デコードを代行しない。汎用`Record<string, string>`としてそのまま右から左へ受け渡すだけ）。
- **originalFilenameの非ASCII対応**: `originalFilename`は上記の汎用`metadata`ループとは別に、専用フィールドとして渡す（`x-amz-meta-original-filename`）。これも値はASCIIである必要があるため、日本語ファイル名はpercent-encodingする契約とする。`process-handler`はデコード後、非画像ファイルの`Content-Disposition`ヘッダーに`filename*=UTF-8''...`（RFC 6266）形式で埋め込む。
- **合計サイズ上限**: S3はユーザー定義メタデータの合計サイズ（キー+値、`x-amz-meta-`プレフィックス込み）を2KBに制限する。`generatePresignedUpload`は渡された`metadata`・`originalFilename`の合計サイズを計算し、2KBを超える場合は例外を投げる（超過した場合にS3側で無言で切り詰められる／アップロード自体が拒否される、という分かりにくい失敗を避けるため、ライブラリ側で早期に検証する）。

## 設計方針4: 画像配信はオンデマンドリサイズ＋CDNキャッシュ

**ストレージ構造**:

```text
raw/{fileId}      … アップロードされた生バイト列。永久保存・非公開（EXIF等未処理のため直接配信しない）
master/{fileId}   … process-handlerがEXIF除去・向き補正した「処理済みオリジナル」。永久保存。
                    画像の場合は長辺の上限（image policy、Parameter Store経由で実行時取得、既定4096px）でリサイズ済み。
                    非画像ファイルの場合はmasterがそのまま配信対象そのもの（バリアント概念なし）
cache/{fileId}/{width}  … オンデマンドで生成したリサイズ結果。DynamoDBでは管理しない使い捨てキャッシュ。
                          S3 Lifecycleルールで一定期間（Terraform変数`image_cache_ttl_days`、既定30日）後に自動削除。
                          期限切れ後に再度リクエストされたら`master`から再生成するだけで良い
```

**配信経路は1つのCloudFront Distribution内で2つのキャッシュビヘイビアに分ける**（Lambda Function URLの応答サイズ上限（バッファ型で約4.4MB相当）に、非圧縮の大きいmasterや非画像ファイルが収まらない可能性があるため、masterはS3から直接配信しLambdaを経由させない）:

```text
[呼び出し側の署名発行API] --権限チェック後、署名付きURLを発行-->
[クライアント] --GET signedUrl--> [CloudFront]
                                        │ 両ビヘイビアともtrusted_key_groupsで署名・有効期限を検証（不正なら403）
                                        ├─ ビヘイビア "/master/*"（widthなし）
                                        │     → オリジン=S3（OAC、Lambda非経由）→ master/{fileId} をそのまま返す
                                        │       応答サイズはS3が直接ストリーミングするため制限を受けない
                                        └─ ビヘイビア "/resize/*"（width指定、画像のみ）
                                              → キャッシュヒット時はエッジからそのまま返す
                                              → キャッシュミス時のみ [media-handler Lambda] を起動
                                                    1. widthが`1`以上・image policy（Parameter Store経由で実行時取得、後述）の`masterMaxDimension`以下か検証（健全性チェック）
                                                    2. S3の cache/{fileId}/{width} を確認、あれば返す
                                                    3. 無ければ master/{fileId} を取得しsharpでresize(width)
                                                       → cache/{fileId}/{width} に書き込み → 返す
```

**署名は呼び出し時点で確定した具体的なURLに対して発行する**（`width`を指定するなら`/resize/{fileId}?width=N`、しないなら`/master/{fileId}`）。ワイルドカード署名はしない。「どの画面でどの幅が必要か」の判断は呼び出し側の責務であり、ライブラリはその判断を持たない。

**CloudFrontのキャッシュキー設計**: `width`クエリパラメータはキャッシュキーに含めるが、署名パラメータ（`Expires`/`Signature`/`Key-Pair-Id`）はキャッシュキーから除外する（含めると署名URLを取得し直すたびにキャッシュがすべて外れる）。同一`fileId`+`width`なら誰が取得した署名URLでもエッジキャッシュを共有できる。

**署名の有効期限は丸める**: `Expires`を秒単位の生の現在時刻+TTLにすると、署名APIを呼ぶたびに毎回異なる署名URLになりクライアント側のブラウザキャッシュが効かない。有効期限を例えば1時間単位に切り上げてから署名することで、同じ時間帯内は同一URLになりブラウザキャッシュも活用できる。

**404の扱い**: media-handlerやS3が404を返すケースでCloudFrontのネガティブキャッシュ（既定約10秒）が悪さをしないよう、エラー応答には`Cache-Control: no-store`を付け、CloudFrontの`custom_error_response`で該当ステータスの`error_caching_min_ttl`を0にする。

**同時実行によるキャッシュ生成の重複**: 同一`{fileId}/{width}`への複数同時リクエストで、複数のLambda実行が同時にリサイズ・S3書き込みを行う可能性があるが、実害は小さい（S3のPutObjectはアトミックな上書き、内容も同一になるため）。無駄な計算コストを抑えたい場合は`reserved_concurrent_executions`やCloudFrontのOrigin Shieldで対策できるが、初期実装では必須としない。

### リサイズのサイズ設計（2026-10-05改訂。設計レビューで指摘されたMajor事項への対応）

初版の記述は「`max`は`masterMaxDimension`と重複する（masterより大きくリサイズするのはアップスケールであり意味がない）」としていたが、これは`masterMaxDimension`が**長辺の上限値**であって、個々のmasterの**実際の寸法**ではないことを見落としていた。実際には以下の2つの問題がある。

1. **アップスケール**: 横800×縦600のmasterに対して`width=4096`を指定すると、実装上は4096×3072へのアップスケールになってしまう（意味がないだけでなく無駄な計算・転送）。
   - **対応**: `media-handler`のsharp呼び出しに`withoutEnlargement: true`を指定する。これによりsharpは要求された幅がmaster本来の幅を超える場合、masterの実寸法のまま返す（アップスケールしない）。これは実装済みであり、設計書として明記しておく。
2. **Lambda Function URLの応答サイズ上限超過**: `masterMaxDimension`の既定値（4096px）に近い幅をリクエストすると、JPEG品質次第では出力が数MBになり得る。Lambda Function URLのバッファ型応答は約6MB、base64エンコードを考慮すると実質約4.4MBが上限であり、**これを超えると502になる**。しかも一度`cache/{fileId}/{width}`に書き込まれてしまうと、S3 Lifecycleで自動削除される（既定30日）までの間、そのサイズへのリクエストは毎回502になり続ける。
   - **対応（実装済み）**: `media-handler`は、リサイズ後のバッファサイズが安全な閾値（4MB）を超える場合、JPEG品質を段階的に下げて（80→60→40）再エンコードを試み、それでも閾値を超える場合はキャッシュへの書き込みを行わずに413（Payload Too Large）相当のエラーを返す（`Cache-Control: no-store`を付け、この失敗自体をキャッシュに残さない）。
   - **運用上のガイダンス**: `masterMaxDimension`を既定の4096pxのまま運用する場合、上記のフォールバックが頻発する可能性がある。高精細な配信が不要なユースケースでは、image policyの`masterMaxDimension`を2048px程度に抑えることを推奨する（設計書としては既定値を変更しないが、呼び出し側が自身のユースケースに応じて調整できるようimage policyの運用ドキュメントに明記する）。

## 設計方針5: 認証は署名付きURL方式（CloudFront trusted key group）。ただし「誰に発行するか」はライブラリの関心事ではない

**認証（署名URLを発行できる）と認可（閲覧して良いか）は明確に分離する**。このライブラリの`sign.ts`・`media-handler`は「有効なリクエストになら署名する/検証する」だけを担い、**「誰に署名URLを発行するか」の判断は一切持たない**。その判断は完全に呼び出し側アプリのビジネスロジックに委ねられる。呼び出し側は将来どれだけ認可ロジックを変更（例: より細かい権限制御）しても、このライブラリ側（`sign.ts`・`media-handler`）は一切変更不要になるよう設計する。

- **却下した代替案**:
  - 署名付きCookie: 呼び出し側のAPIがLambda Function URL経由の場合、任意ドメイン向けのCookieを設定できないケースが多い。モバイルクライアント（画像表示ライブラリ）でもCookie運用が煩雑。
  - Lambda自身が毎回認証ヘッダーを検証する独自トークン方式: `<img src>`等の画像表示要素はリクエストヘッダーを付与できないため、認証情報をURLに埋め込む以外の選択肢がない。かつCDNキャッシュがヒットするとLambda自体が呼ばれず検証をすり抜けるため、追加のエッジ実装が必要になりネイティブ署名より複雑。
- **採用**: CloudFrontのネイティブ署名付きURL機能（`trusted_key_groups`）。CloudFront自身が署名・有効期限を検証するため、キャッシュヒット時も含めて**毎リクエストで**署名検証が行われる（AWS仕様: viewer requestの段階でキャッシュ参照前に検証されるため、キャッシュが残っていること自体は無効な署名を持つ第三者への漏洩経路にならない。実装時にこの挙動を実地確認すること）。

**Critical: media-handler Function URL自体の認証も塞ぐ必要がある**: CloudFrontの署名検証はCloudFrontのエッジ側で行われるが、`media-handler`のFunction URL自体が`authorization_type: NONE`のままだと、**CloudFrontを経由せずFunction URLを直接叩くことで署名検証を完全に迂回できてしまう**。対策:

- `media-handler`のFunction URLは`authorization_type: AWS_IAM`にする。
- CloudFrontのLambdaオリジン用にOAC（`origin_access_control_origin_type = "lambda"`）を設定する。
- `aws_lambda_permission`で`principal = "cloudfront.amazonaws.com"`・`source_arn = <このDistributionのARN>`を指定し、CloudFrontからの呼び出しのみを許可する（`lambda:InvokeFunctionUrl`権限。`lambda:InvokeFunction`権限も必要かは実装時に要確認）。
- **`allowedWidths`という独立フィールドは不要**: `media-handler`に到達するには有効な署名付きURLが必須（前述のCritical対策）であり、署名は呼び出し側アプリの認証済みロジックしか発行できないため、widthの健全性チェックに独立したapp設定値は要らない。`min`は技術的に固定の下限（`1`。sharpの仕様上意味を持つ最小値）で良く、`max`は既にimage policyに含まれる`masterMaxDimension`と重複する（masterより大きくリサイズするのはアップスケールであり意味がない）。よって**`media-handler`は`1 <= width <= masterMaxDimension`を健全性チェックとして使い、`allowedWidths`という別フィールドは持たない**。
- 同様に、S3オリジン（`/master/*`ビヘイビア）もOACで保護し、S3バケットへの直接アクセスはCloudFrontからのみ許可する。**バケットポリシーの`Resource`は`master/*`プレフィックスに限定し、バケット全体を誤って許可しないこと**（実装ミスで`raw/*`・`cache/*`まで公開経路が開いてしまう典型的な事故を防ぐ）。`raw/*`・`cache/*`にはOACへの許可を一切与えない（`cache/*`はmedia-handlerの実行ロール経由でのみアクセス）。

**Critical: 署名URLを呼び出し側の永続フィールドに書き込んではいけない**: 署名URLは有効期限付きである。呼び出し側アプリが「解決済みURL文字列」をそのまま自身のエンティティの永続フィールドに保存する設計にすると、有効期限切れ後に壊れたリンクになる。**呼び出し側は、永続化する「安定した参照（fileId）」と、表示のたびに都度取得する「解決済み表示用URL（応答専用、永続化しない）」を明確に分離すること**。これはライブラリの制約というより、ライブラリを使う呼び出し側が必ず守るべき統合上の注意点である。

**署名鍵の管理**:

- RSA鍵ペア（**2048ビット固定**。CloudFrontは4096ビットRSA公開鍵を受け付けないため）を生成し、呼び出し側の秘密情報管理の仕組み（Parameter Store等）に公開鍵・秘密鍵を登録する。
- 公開鍵はTerraform変数（`signing_public_key_param`、SSM Parameter名を渡す想定）として受け取り、`aws_cloudfront_public_key`→`aws_cloudfront_key_group`とTerraformで渡す。
- 秘密鍵はLambdaの環境変数やTerraformのdata sourceには流さない。署名を生成する呼び出し側の署名発行APIが実行時にSecrets Manager/Parameter Store等から取得しモジュールスコープにキャッシュするパターンを推奨する。**秘密鍵が必要なのは署名を生成するコンポーネントだけ**（`process-handler`・`media-handler`には権限を付けない、最小権限）。
- key groupは複数鍵を保持できるため、将来の鍵ローテーションにも対応できる。

**image policyの管理（画像サイズ等はTerraform変数にしない）**:

- masterの最大寸法（`masterMaxDimension`）・許可contentType（`allowedContentTypes`）・最大アップロードサイズ（`maxUploadSize`）は、**1つのJSON値（image policy）としてParameter Store等に保存**し、Terraformが管理するのは**そのパラメータの「名前」だけ**（`image_policy_param`という変数でパスを受け取る）。**widthの健全性チェックには独立フィールドを持たない**（`min`は固定`1`、`max`は`masterMaxDimension`を流用すれば十分。詳細は前述）。
- 値自体（JSON本体）は署名鍵と同じ「呼び出し側の秘密情報管理の仕組みで登録・更新する」対象とし、**変更してもTerraform apply・Lambda再デプロイを必要としない**（Lambdaはモジュールスコープにキャッシュしつつ、コールドスタートのたびに再取得する。頻繁な変更に即座に追従する必要がなければこれで十分）。
- 取得が必要なコンポーネント: 呼び出し側のpresign発行処理（`allowedContentTypes`/`maxUploadSize`）、`process-handler`（`masterMaxDimension`）、`media-handler`（widthの健全性チェック上限として`masterMaxDimension`を流用）。それぞれ`ssm:GetParameter`権限が必要（機密情報ではないためSecureStringである必要はない）。
- これにより、呼び出し側アプリが運用判断（許可contentTypeの追加、最大アップロードサイズの変更等）に応じて画像ポリシーを調整する際、インフラのデプロイサイクルに縛られない。**具体的なwidthの値はimage policyでは管理しない**（署名付きURL必須のため、widthの選択は呼び出し側アプリコードの判断で良く、`media-handler`側は`masterMaxDimension`による健全性チェックのみ行う）。
- **取得失敗時はfail-closed**: Parameter Storeにimage policyが未登録・不正なJSONの場合、安全側の既定値にフォールバックするのではなく、該当リクエストを拒否する（呼び出し側のpresign発行処理はリクエストを拒否、`media-handler`はリサイズ要求を拒否）。「取得できない＝無制限を許可」になってしまう実装ミスを避けるため。

## セキュリティ・堅牢性対応一覧

| #                           | 問題                                                                                                                         | 対応                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                           | オリジナル・マスターファイルの意図しない公開                                                                                 | S3バケットは非公開（OAC経由のみ）。`raw/*`・`cache/*`はCloudFrontからも直接公開しない（`cache/*`はmedia-handler Lambda経由のみ）                                                                                                                                                                                                                                                                                                                                                            |
| 2                           | クライアントがメタデータ（所有者情報等）を偽装できる                                                                         | presigned POSTのpolicyでメタデータフィールドを`eq`条件固定。除外リスト方式ではなく、**サーバー側が値を強制する**方式にする                                                                                                                                                                                                                                                                                                                                                                  |
| 3                           | 許可MIMEタイプのリストがクライアント指定になっていた                                                                         | `allowedContentTypes`はサーバー設定（image policy、Parameter Store経由）としてのみ渡す。クライアントが指定した値は使わない                                                                                                                                                                                                                                                                                                                                                                  |
| 4                           | contentType偽装による無加工配信XSS                                                                                           | マジックナンバー照合、`image/svg+xml`除外、非画像は`Content-Disposition: attachment`、CloudFrontに`X-Content-Type-Options: nosniff`                                                                                                                                                                                                                                                                                                                                                         |
| 5                           | `pending`レコードの永久放置（TTLが機能しない）                                                                               | presign時にレコードを作らない設計にしたため、そもそも放置レコードが発生しない                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6                           | 呼び出し側のアーキテクチャ規約違反（DBクライアント直接使用による層構造バイパス）                                             | ライブラリは呼び出し側の認可レイヤー（Handler→Service→Repositoryのような層構造）に乗る形で個別取得を実装することを推奨する。presign発行（S3署名のみ）はDBアクセスがないためこの規約の対象外                                                                                                                                                                                                                                                                                                 |
| 7                           | 汎用CRUD LambdaのIAM認証パスが署名検証を行っていなかった問題                                                                 | [ADR 0001](adr/0001-fix-iam-auth-bypass.md)で修正済み。メディア機能とは独立した既存課題だった                                                                                                                                                                                                                                                                                                                                                                                               |
| 8                           | 呼び出し側の認証方式（ヘッダーベースの識別子等）が署名検証を伴わない場合がある                                               | ライブラリ側の制約ではなく、呼び出し側アプリの認証方式の限界として認識する事項                                                                                                                                                                                                                                                                                                                                                                                                              |
| 9                           | `process-handler`が失敗・タイムアウトした場合、`failed`レコードが作られずクライアントが永久にポーリングし続ける              | `process-handler`にLambda非同期呼び出しの`on-failure`宛先（SQS DLQ）を設定し、DLQ経由で`failed`レコードを書き込む後続処理を追加する                                                                                                                                                                                                                                                                                                                                                         |
| 10                          | presign発行時のアップロード権限チェック                                                                                      | ライブラリはこの判断を持たない。呼び出し側が自身のビジネスロジックでpresign発行前に権限チェックを行うことを前提とする                                                                                                                                                                                                                                                                                                                                                                       |
| 11                          | 画像配信CDNに認証が全くない                                                                                                  | CloudFront署名付きURL（trusted key group）を必須にする                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 12                          | 署名付きURLの有効期限とアプリ側キャッシュの不整合                                                                            | クライアント側の画像キャッシュキーは署名パラメータを含めない値（`{fileId}-{width}`等）にする。アプリ側キャッシュの有効期限は署名URLの有効期限より必ず短くする                                                                                                                                                                                                                                                                                                                               |
| 13                          | オンデマンドリサイズの悪用（任意幅の大量リクエストによるコスト増）                                                           | 署名は呼び出し時点で確定した具体的な幅に対して発行する（ワイルドカード署名はしない）。加えて`media-handler`が`1 <= width <= masterMaxDimension`を健全性チェックとして検証する。リサイズキャッシュはS3 Lifecycleで自動的に有限化される                                                                                                                                                                                                                                                       |
| 14（Critical）              | 署名付きURLを永続フィールドにそのまま書き込むと、期限切れ後に壊れたリンクになる                                              | 呼び出し側は「安定した参照（fileId）」と「表示専用の解決済みURL（応答専用、永続化しない）」を分離すること                                                                                                                                                                                                                                                                                                                                                                                   |
| 15（Critical）              | `media-handler`のFunction URLが`NONE`だと、CloudFrontを経由せず直接叩くことで署名検証を迂回できる                            | Function URLを`AWS_IAM`にし、CloudFront用OAC（lambdaタイプ）＋`aws_lambda_permission`（principal=cloudfront、source_arn=Distribution ARN）で保護する                                                                                                                                                                                                                                                                                                                                        |
| 16（Major）                 | Lambda Function URLの応答サイズ上限（バッファ型で約4.4MB相当）に大きいmaster・非画像ファイルが収まらない可能性               | masterの配信（`width`省略時）はS3オリジン（OAC）から直接行い、Lambdaを経由させない。Lambdaオリジンはリサイズ（`/resize/*`、幅を絞ったサイズのみ）専用にする                                                                                                                                                                                                                                                                                                                                 |
| 17（Minor）                 | 404応答がCloudFrontのネガティブキャッシュ（既定約10秒）で意図せず長引く                                                      | エラー応答に`Cache-Control: no-store`を付け、`custom_error_response`の`error_caching_min_ttl`を0にする                                                                                                                                                                                                                                                                                                                                                                                      |
| 18（Minor）                 | 署名のたびに`Expires`が変わり、同じ画像への短時間の再取得でもブラウザキャッシュが効かない                                    | `Expires`を1時間単位等に切り上げてから署名し、同一時間帯内は同じURLになるようにする                                                                                                                                                                                                                                                                                                                                                                                                         |
| 19（Major、2026-10-05追加） | DLQ経由で`failed`レコードを書く際、呼び出し側のアプリ固有メタデータ（`ownerId`等）が失われる                                 | `process-handler-dlq.ts`はLambda非同期呼び出しの失敗通知（`requestPayload`にS3イベントのみ含む）からはアプリ固有メタデータを得られない。DLQハンドラ自身が`raw/{fileId}`をHeadObjectしてメタデータを読み直し、`failed`レコードに含める（呼び出し側がownerId等でスコープ絞り込みしたポーリングでも、失敗が見えるようにするため）                                                                                                                                                              |
| 20（Major、2026-10-05追加） | `allowedContentTypes`をimage policyで自由に追加できる一方、マジックナンバー照合表・sharpの対応形式はコード内に固定されている | 「画像専用を前提にしない」という設計原則と矛盾しないよう、マジックナンバー照合表に無いcontentTypeは検証をスキップする（素通りではなくfail-openになる点を許容する）、または明示的に「ライブラリが対応する画像形式のサブセットのみ`image/*`として扱われ、それ以外は非画像として無加工コピーされる」と運用ドキュメントに明記する。少なくとも、sharpが対応しない形式（例: HEIC）を`allowedContentTypes`に追加しても画像処理に失敗するだけで、セキュリティ上の対応漏れにはならないことを確認する |
| 21（Major、2026-10-05追加） | 呼び出し側の既存Shadow Records設定（`SHADOW_*`環境変数）を`process-handler`に渡す手段がTerraformモジュールに無い             | `terraform/media/variables.tf`に`shadow_config`相当の変数（任意、省略時はライブラリの既定値）を追加し、`process-handler`・`media-handler`の環境変数として配線する。呼び出し側がShadow設定を変更している場合、media側だけ既定値のままだとShadow Recordの形式がずれ、`list`/`find`が壊れる                                                                                                                                                                                                    |

## メタデータ管理（DynamoDB方式）

**image policyの型**（呼び出し側のpresign発行処理・`process-handler`・`media-handler`がParameter Storeから実行時取得するJSON。前述「image policyの管理」参照）:

```ts
interface ImagePolicy {
  masterMaxDimension: number; // process-handlerがmaster生成時に使う長辺上限。
  // media-handlerのwidth健全性チェックの上限もこの値を流用する
  // （下限は固定`1`。署名付きURL必須のため独立フィールドは持たない）
  allowedContentTypes: string[]; // 呼び出し側のpresign発行処理が使う許可MIMEタイプ
  maxUploadSize: number; // 呼び出し側のpresign発行処理が使う最大アップロードサイズ
}
```

**共通フィールド**（アプリ非依存）:

```ts
interface MediaRecord {
  id: string; // fileId (ULID)
  status: 'completed' | 'failed'; // pendingは存在しない（レコードが無ければ処理中の意）
  contentType: string; // アップロード時に申告され、実バイトと照合済みのMIMEタイプ
  outputContentType: string; // masterとして実際に保存される形式（画像なら'image/jpeg'、それ以外は
  // contentTypeと同じ）。contentTypeとの不一致を明示的に区別する
  originalFilename?: string; // 元のファイル名（拡張子込み）
  dimensions?: { width: number; height: number }; // master（画像の場合のみ）の寸法
  size?: number; // masterのファイルサイズ
  error?: string;
  createdAt: string;
  updatedAt: string;
  // アプリ固有の追加フィールドは、process-handlerがS3オブジェクトメタデータから
  // 読み取った値をそのまま書き込む（ライブラリはフィールド名を規定しない）
}
```

**注**: `url`はレコードに持たない。配信には必ず署名付きURLの発行が必要なため、呼び出し側は`id`を保持し、表示のたびに署名URLを取得する。

- **レースコンディション対策**: `process-handler`は`updateOne`を`upsert:true`で呼び出す（`insertOne`は使わない。`insertOne`はid指定時に条件なしPutになり、S3イベントの重複配信で2回目が来た際に既存のShadow Recordが更新されず不整合を起こすため）。S3イベントの重複配信（at-least-once）に対しては同一`fileId`への冪等な上書きになるため実害は小さいが、条件付き書き込みが無い制約はADRに明記する。
- **ポーリングは0件判定で行う**: `list({ id: fileId })`のように取得し、0件＝処理中と判定する（`findOne`相当のAPIはレコード不在時に404ではなくエラーを投げる実装になっている場合があるため、`list`/`getList`相当のAPIを使うこと）。
  - **重要（Major）: `{id}`だけのフィルタは、ポーリングのたびに全件スキャンになりうる**。ソート指定を省略すると既定のソートキーでの評価になり、`id`の完全一致だけではID直引き経路に回らないことがある。ソートを明示してID直引き（ConsistentRead付きの1クエリ）に回す実装にすること。
  - **呼び出し側が権限スコープ付きの認可レイヤーを使う場合は特に注意**: ライブラリのID直引き経路が`id`以外のフィルタ（呼び出し側の認可レイヤーが付与するスコープ条件）を無視する実装になっていると、他人のレコードが読めてしまう潜在バグになりうる。ライブラリ側は「idの完全一致ならソート条件によらずID直引きに回すが、残りのフィルタも引き続き適用する」という実装にすること。
  - **現状のステータス（2026-10-05確認、未解決）**: 本体（`src/server/operations/find/idQuery.ts`）のID直引き経路は、現時点では`id`以外のフィルタ（スコープ条件）を適用しない実装のままである。この修正が入るまで、呼び出し側が権限スコープ付きの認可レイヤー経由でmediaレコードをポーリングする場合、**ID直引きの最適化は使えない**（スコープを無視して他人のレコードを返してしまうため）。やむを得ず、ソート未指定の`{id}`フィルタ（全件スキャンにフォールバックする、遅いが安全な経路）を使うか、本体の修正を待つこと。どちらを選ぶかは呼び出し側の判断とする。
  - **ポーリングが区別すべき状態と待ち方（2026-10-05追加、Major事項への対応）**: 「0件」は実際には複数の異なる状態（まだ処理中／アップロードされなかった／`process-handler`の通知が`maximum_event_age`の既定値（6時間）に達するまで遅延している等）を一括りにしている。呼び出し側は、presign発行からの経過時間に対して妥当なタイムアウト（例: 60秒程度。通常の処理は数秒で終わるため）を設け、タイムアウトしたら「アップロードされなかった/失敗した」とみなしてユーザーに再試行を促すこと。`process-handler`の`aws_lambda_function_event_invoke_config`で`maximum_event_age_in_seconds`を短く設定する（例: 300秒）ことで、DLQ経由の`failed`書き込みが遅延する上限も抑えられる。

## コンポーネント一覧（`src/server/media/`）

- `presign.ts`: `generatePresignedUpload({ s3Client, bucket, contentType, originalFilename, fileSize, allowedContentTypes, maxUploadSize, metadata })` — DynamoDBには一切触れない。`metadata`の各キーを`x-amz-meta-{key}`としてpolicyの`eq`条件に固定する（キー形式・予約キー・サイズ上限の契約は前述「メタデータの契約」参照）。ULID採番、`{ fileId, uploadUrl, fields }`を返す。`exports`の`./server/media/presign`として公開。
- `upload-handler.ts`: `createUploadHandler(config)` — presign/sign発行用のLambda Function URLハンドラを生成する**ファクトリ関数**（固定のハンドラ本体ではない）。「誰にpresign/署名URLを発行してよいか」の認可判断はアプリごとに異なるため、`authorize`フックとして呼び出し側に注入させる設計にした（詳細はconfig引数のJSDoc参照）。
  - **位置づけ（2026-10-05改訂）**: 当初、呼び出し側（モバイルBFF等、既存の認証済みHTTPレイヤーを持つアプリ）は`presign.ts`・`sign.ts`を自前のルートから直接呼ぶため本コンポーネントは不要と判断し一度削除したが、**認証方式が異なる複数のクライアント（例: モバイルアプリ用の独自BFFとは別に、Cognito JWTで認証する管理画面）を持つアプリでは、管理画面側に対応する既存のHTTPレイヤーが無いことがある**。このような「presign/sign発行専用の小さな独立Lambdaを新設する必要がある」ケースのために復活させた。呼び出し側は`createUploadHandler({ bucket, imagePolicyParam, signingPrivateKeyParam, keyPairId, baseUrl, authorize })`を呼び、`authorize`に自分の認証方式（JWT検証等）を実装した関数を渡して、結果を自前でLambdaとしてバンドル・デプロイする。
  - `exports`の`./server/media/upload-handler`として公開（事前バンドルされた`.cjs`成果物ではなく、通常のライブラリエクスポート）。
- `sign.ts`: `signMediaUrl({ fileId, width?, keyPairId, privateKey, baseUrl, expiresInSeconds })` — Canned Policyで署名付きURLを生成する共通ロジック。`width`指定時は`/resize/{fileId}?width=N`、省略時は`/master/{fileId}`のURLに署名する（**呼び出し元が具体的な幅を決めてから呼ぶ**。ワイルドカード署名はしない）。`Expires`は指定した粒度（例: 1時間）に切り上げてから署名する。秘密鍵の取得はこの関数の責務外とし、引数で受け取るだけにする。`exports`の`./server/media-sign`として公開。
- `process-handler.ts`: S3 `ObjectCreated`イベント（`raw/*`）をトリガーに起動。HeadObjectでメタデータ取得→マジックナンバー検証→`contentType`で分岐:
  - 画像（svg除く）: sharp: rotate()（EXIF Orientationに基づく向き補正）→ 長辺がimage policy（Parameter Storeから実行時取得、既定4096px）の`masterMaxDimension`を超える場合のみresize → strip metadata → jpeg（limitInputPixelsで巨大画像を拒否）→ `master/{fileId}`へ配置
  - 非画像: CopyObject（MetadataDirective:REPLACEでContent-Disposition/Content-Typeを明示設定）→ `master/{fileId}`へ配置（単一ファイル、リサイズキャッシュ概念なし）
  - 最後に`updateOne`操作（`upsert:true`、テーブル名は環境変数`TABLE_NAME`）で呼び出し側の既存テーブルにレコードを作成/更新
  - **失敗時のハンドリング**: Lambda非同期呼び出しの`on-failure`宛先としてSQS DLQを設定する。例外・タイムアウトでリトライが尽きた場合、DLQをトリガーに起動する小さなハンドラ（`process-handler-dlq.ts`）が`status:'failed'`レコードを書き込む。
  - **エラー分類（2026-10-05追加、Major事項への対応）**: 「検証エラー」と「インフラ障害」を明確に区別する。
    - **検証エラー**（マジックナンバー不一致、破損画像、`limitInputPixels`超過等、リトライしても結果が変わらないもの）は、例外を投げずその場で`status:'failed'`レコードを直接書き込み、正常終了する（DLQを経由しない）。リトライ・DLQ経由だと最大で`maximum_event_age`の遅延が発生し、クライアントを無駄に待たせるため。
    - **インフラ障害**（S3/DynamoDBの一時的なエラー、タイムアウト、メモリ不足等、リトライで解消し得るもの）は例外を投げ、Lambdaの非同期リトライに任せる。リトライが尽きた場合のみDLQ経由で`failed`になる。
    - `limitInputPixels`の具体的な値は、Lambdaのメモリサイズ（既定1024MB）に対して安全な上限（例: sharpの既定である約1億画素よりも保守的な値）をimage policyまたはコード内の固定値として定める。
  - **DLQハンドラの上書き防止**: S3イベントの重複配信により、`process-handler`本体が先に`completed`を書き込んだ後にDLQ経由の古いリトライが`failed`で上書きする可能性がある。DLQハンドラは書き込み前に既存レコードを読み取り、`status:'completed'`であれば何もしない。
  - **環境変数の一致**: 呼び出し側の既存Shadow Records設定に関する環境変数は、呼び出し側の既存Lambdaと揃えること（Shadow Recordの形式がずれないようにする）。
  - この関数はSSM署名鍵にはアクセスしない（不要）。image policyの`masterMaxDimension`はParameter Storeから実行時取得（モジュールスコープにキャッシュ、コールドスタートごとに再取得）。
  - `exports`の`./server/media-process-handler`として公開。
- `media-handler.ts`: CloudFrontの`/resize/*`ビヘイビアのオリジンとして動作するLambda Function URLハンドラ（**Function URLは`AWS_IAM`で保護し、CloudFrontからのみ呼べるようにする**）。リクエストパス（`{fileId}`）とクエリパラメータ（`width`）を受け取り:
  1. `width`が`1`未満、またはimage policy（Parameter Storeから実行時取得、モジュールスコープにキャッシュ）の`masterMaxDimension`を超える場合は400（健全性チェック。署名付きURL必須のため、これは異常値を弾く粗いガードで良い）
  2. `cache/{fileId}/{width}`をS3で確認。存在すれば返す
  3. 無ければ`master/{fileId}`を取得しsharpで`resize(width)`（アスペクト比維持）→ `cache/{fileId}/{width}`へ書き込み → 返す
  4. `Cache-Control`ヘッダー（長めのmax-age、immutable）を設定し、CloudFrontエッジキャッシュも効かせる
  - この関数はSSM署名鍵にはアクセスしない（不要）。S3の`master/*`読み取り・`cache/*`読み書き権限のみ持つ。image policy取得のための`ssm:GetParameter`権限は必要。
  - `exports`の`./server/media-handler`として公開
- `types.ts`: `MediaRecord`（共通フィールドのみ）とリクエスト/レスポンス型。`exports`の`./types/media`として公開。

**sharp依存の扱い**: `dependencies`には加えず`devDependencies`のみ。既存のTerraformモジュールはLayer等の成果物を相対パスで参照する構成になっているため、`scripts/build-sharp-layer.sh`（Dockerの`--platform linux/arm64`でビルド）を`npm run build`スクリプトチェーンに組み込み、`dist/sharp-layer.zip`として生成した上でnpm publish対象に含める。`process-handler`・`media-handler`の両方がこのレイヤーを使う。`sharp()`呼び出し時に`limitInputPixels`を設定し、極端に大きい画素数の画像でのDoS的な処理負荷を防ぐ。

## Terraformモジュール `terraform/media/`

- S3バケット（呼び出し側のプロジェクト名・環境名から組み立てる、**完全非公開**、OAC経由のみアクセス可能）
  - `raw/*`: 恒久保存。CloudFrontからも公開しない。バケットポリシーでOACにこのプレフィックスへの`s3:GetObject`を許可しない
  - `master/*`: 恒久保存。CloudFrontの`/master/*`ビヘイビア（S3オリジン、OAC）からのみ公開。**バケットポリシーの`Resource`は`master/*`に限定し、バケット全体を誤って許可しないこと**
  - `cache/*`: **Lifecycleルールで`image_cache_ttl_days`（既定30日）経過後に自動削除**。CloudFrontのどのビヘイビアにも直接マッピングしない。OACへの許可も与えない
  - **CORS設定（2026-10-05追加、Critical事項への対応）**: ブラウザ（管理画面等）からpresigned POSTで直接S3へアップロードする場合、`aws_s3_bucket_cors_configuration`が無いとプリフライトリクエストが失敗しアップロードが全滅する。`AllowedOrigins`をTerraform変数（`allowed_upload_origins`、呼び出し側のフロントエンドのオリジンを渡す。モバイルアプリ（React Native）はCORSの対象外のため影響しないが、ブラウザから使う場合は必須）として受け取り設定する
- S3イベント通知（`raw/*` ObjectCreated → `process-handler` Lambda）
- SQS DLQ（`process-handler`の`on-failure`宛先）
- `process-handler` Lambda（S3トリガーのみ、arm64、sharp Layer付き、メモリ1024MB/タイムアウト60秒、DLQ設定済み、image policy（`masterMaxDimension`）取得のため`ssm:GetParameter`権限、呼び出し側が渡す既存テーブルARNへの`dynamodb:PutItem`等の権限が必要）
- `media-handler` Lambda（CloudFrontの`/resize/*`ビヘイビア専用オリジン、**Function URLは`AWS_IAM`**、arm64、sharp Layer付き、S3の`master/*`読み取り・`cache/*`読み書き権限、image policy（`masterMaxDimension`をwidth上限チェックに流用）取得のため`ssm:GetParameter`権限。**署名鍵へのSSM権限・DynamoDB権限は付与しない**）
- `aws_lambda_permission`（`media-handler`向け、principal=`cloudfront.amazonaws.com`、source_arn=Distribution ARN）
- CloudFront Distribution（新規・独立）:
  - ビヘイビア`/master/*`: オリジン=S3（OAC）、`trusted_key_groups`必須
  - ビヘイビア`/resize/*`: オリジン=`media-handler` Function URL（Lambda用OAC）、`trusted_key_groups`必須、キャッシュポリシーは`width`クエリパラメータをキャッシュキーに含め署名パラメータは除外、オリジンリクエストポリシーはHostヘッダーを転送しないもの（Function URLがHostヘッダー転送時に403を返す実装があるため）
  - `custom_error_response`でエラー系ステータスの`error_caching_min_ttl`を0に設定
  - - Route53 Aliasレコード（`domain_name`/`acm_certificate_arn`/`route53_zone_id`はオプション変数）
- `aws_cloudfront_public_key`・`aws_cloudfront_key_group`（公開鍵はSSM Parameter経由でTerraform変数として受け取る）
- Terraform変数: `table_name`・`table_arn`、`image_cache_ttl_days`（既定30、S3 Lifecycleの設定値なのでTerraform変数のまま）、`signing_public_key_param`（SSM Parameter名）、`image_policy_param`（image policy JSONを格納するSSM Parameter名。値そのもの＝`masterMaxDimension`・`allowedContentTypes`・`maxUploadSize`はTerraform変数にせず、呼び出し側の秘密情報管理の仕組みで別途登録・更新する）
- **Terraformの依存関係の向き**: `media`モジュールが呼び出し側のCloudFront・テーブルARNに依存する片方向にし、循環依存を避ける。`media`モジュールのoutput（`key_pair_id`・配信ベースURL）を呼び出し側の署名発行コンポーネントへ配線する必要がある。

## 既知の制約・今後の課題

- S3イベント重複時の厳密な排他制御: 条件付き書き込み機能が無いため、`updateOne`+`upsert:true`での冪等性確保に留める。将来的に条件付き更新を本体に追加することを検討
- media-handlerの同時実行によるキャッシュ生成の重複: 実害が小さいため初期実装では対策を必須としない
- **`process-handler`が呼び出し側の既存テーブルに直接書き込む設計は、「DBクライアント直接使用による層構造バイパス」という、presign時の`pending`レコード案を撤回した理由（設計方針2）と同じ種類の懸念を内包する**（セキュリティ表#6で「presignはDBアクセスが無いため対象外」としているが、`process-handler`はS3イベント駆動で呼び出し側の層構造の外からDBへ書き込む）。S3イベント駆動のバックグラウンド処理という性質上、呼び出し側のHTTPリクエスト処理層（Handler→Service→Repository）に乗せることは構造的にできないため、この経路に限っては許容する設計判断としつつ、呼び出し側は`process-handler`が書き込むレコードの形（`MediaRecord`共通フィールド+予約キー）を自身のバリデーション・認可ロジックと整合させる責任を負うことを明記する
- **本体のID直引き経路のスコープ無視問題（前述「ポーリング」節参照）は未解決**。修正されるまで、呼び出し側は権限スコープ付きのポーリングでID直引き最適化を使えない
- **2026-10-05追記（Opusレビューで指摘、Minor・未対応）**:
  - `process-handler`のHeadObject→Range GET→（画像のみ）全量GETの間でS3オブジェクトが上書きされるケース: presignを再利用すればTTL内に同一キーへの再アップロードは理論上可能。実害は無い（contentTypeはpolicyのeq条件で固定され、画像は再エンコード、非画像はContent-Dispositionが強制されるため）が、HeadObjectのETagをGetObjectの`IfMatch`・CopyObjectの`CopySourceIfMatch`に渡し、412時はreturnする（上書き後のオブジェクトは自身のS3イベントで別途処理される）という対策が可能。優先度低、未実装
  - `process-handler`のRange GET（`bytes=0-255`）は、1バイト未満のオブジェクトに対して理論上`InvalidRange`（416）を返しうる。presignの`content-length-range`で下限1バイトに縛っているため正規の経路では発生しないが、検証エラーとして明示的に分類する余地がある。優先度低、未実装
  - `media-handler`のJPEG品質フォールバック（80→60→40）は、品質を変えるたびに`sharp(master)`からデコード・リサイズをやり直している（libvipsはパイプライン結果をキャッシュしないため、発動時は最大3倍の処理時間）。`resize().raw().toBuffer()`を1回だけ実行しraw画素データから品質違いの複数JPEGを生成する方式にすれば改善できるが、発動頻度が低く30秒のLambdaタイムアウトには十分収まるため、優先度低・未実装

## 関連ADR

- [0001-fix-iam-auth-bypass.md](adr/0001-fix-iam-auth-bypass.md): メディア機能実装前提として先に修正した、汎用CRUD LambdaのIAM認証バイパス脆弱性
- メディア機能固有の設計判断（別テーブルを作らない理由、presign時にDBへ書き込まない理由、オンデマンドリサイズ＋署名付きURLを採用した経緯、master/resizeビヘイビア分割の理由、条件付き書き込みが無い制約）は別途ADRとして記録する
