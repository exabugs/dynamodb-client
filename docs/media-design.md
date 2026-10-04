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

## 設計方針3: presign発行のメタデータは汎用マップで受け取る

`generatePresignedUpload`は個別引数（例: owner・カテゴリ等）ではなく、汎用`metadata: Record<string, string>`で受け取る。呼び出し側が自由に渡すアプリ固有フィールド（所有者ID・カテゴリ・紐付け先エンティティのID等）をそのまま`x-amz-meta-{key}`としてpolicyの`eq`条件に固定する。これにより、アプリ固有の語彙がライブラリ本体に漏れ出さない。

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
- 秘密鍵はLambdaの環境変数やTerraformのdata sourceには流さない。署名を生成するLambda（`upload-handler`。呼び出し側が用意する署名発行APIも同様）が実行時にSecrets Manager/Parameter Store等から取得しモジュールスコープにキャッシュするパターンを推奨する。**秘密鍵が必要なのは署名を生成するコンポーネントだけ**（`process-handler`・`media-handler`には権限を付けない、最小権限）。
- key groupは複数鍵を保持できるため、将来の鍵ローテーションにも対応できる。

**image policyの管理（画像サイズ等はTerraform変数にしない）**:

- masterの最大寸法（`masterMaxDimension`）・許可contentType（`allowedContentTypes`）・最大アップロードサイズ（`maxUploadSize`）は、**1つのJSON値（image policy）としてParameter Store等に保存**し、Terraformが管理するのは**そのパラメータの「名前」だけ**（`image_policy_param`という変数でパスを受け取る）。**widthの健全性チェックには独立フィールドを持たない**（`min`は固定`1`、`max`は`masterMaxDimension`を流用すれば十分。詳細は前述）。
- 値自体（JSON本体）は署名鍵と同じ「呼び出し側の秘密情報管理の仕組みで登録・更新する」対象とし、**変更してもTerraform apply・Lambda再デプロイを必要としない**（Lambdaはモジュールスコープにキャッシュしつつ、コールドスタートのたびに再取得する。頻繁な変更に即座に追従する必要がなければこれで十分）。
- 取得が必要なコンポーネント: `upload-handler`（presign発行時の`allowedContentTypes`/`maxUploadSize`）、`process-handler`（`masterMaxDimension`）、`media-handler`（widthの健全性チェック上限として`masterMaxDimension`を流用）。それぞれ`ssm:GetParameter`権限が必要（機密情報ではないためSecureStringである必要はない）。
- これにより、呼び出し側アプリが運用判断（許可contentTypeの追加、最大アップロードサイズの変更等）に応じて画像ポリシーを調整する際、インフラのデプロイサイクルに縛られない。**具体的なwidthの値はimage policyでは管理しない**（署名付きURL必須のため、widthの選択は呼び出し側アプリコードの判断で良く、`media-handler`側は`masterMaxDimension`による健全性チェックのみ行う）。
- **取得失敗時はfail-closed**: Parameter Storeにimage policyが未登録・不正なJSONの場合、安全側の既定値にフォールバックするのではなく、該当リクエストを拒否する（`upload-handler`はpresign発行を拒否、`media-handler`はリサイズ要求を拒否）。「取得できない＝無制限を許可」になってしまう実装ミスを避けるため。

## セキュリティ・堅牢性対応一覧

| #              | 問題                                                                                                            | 対応                                                                                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1              | オリジナル・マスターファイルの意図しない公開                                                                    | S3バケットは非公開（OAC経由のみ）。`raw/*`・`cache/*`はCloudFrontからも直接公開しない（`cache/*`はmedia-handler Lambda経由のみ）                                                                                                      |
| 2              | クライアントがメタデータ（所有者情報等）を偽装できる                                                            | presigned POSTのpolicyでメタデータフィールドを`eq`条件固定。除外リスト方式ではなく、**サーバー側が値を強制する**方式にする                                                                                                            |
| 3              | 許可MIMEタイプのリストがクライアント指定になっていた                                                            | `allowedContentTypes`はサーバー設定（image policy、Parameter Store経由）としてのみ渡す。クライアントが指定した値は使わない                                                                                                            |
| 4              | contentType偽装による無加工配信XSS                                                                              | マジックナンバー照合、`image/svg+xml`除外、非画像は`Content-Disposition: attachment`、CloudFrontに`X-Content-Type-Options: nosniff`                                                                                                   |
| 5              | `pending`レコードの永久放置（TTLが機能しない）                                                                  | presign時にレコードを作らない設計にしたため、そもそも放置レコードが発生しない                                                                                                                                                         |
| 6              | 呼び出し側のアーキテクチャ規約違反（DBクライアント直接使用による層構造バイパス）                                | ライブラリは呼び出し側の認可レイヤー（Handler→Service→Repositoryのような層構造）に乗る形で個別取得を実装することを推奨する。presign発行（S3署名のみ）はDBアクセスがないためこの規約の対象外                                           |
| 7              | 汎用CRUD LambdaのIAM認証パスが署名検証を行っていなかった問題                                                    | [ADR 0001](adr/0001-fix-iam-auth-bypass.md)で修正済み。メディア機能とは独立した既存課題だった                                                                                                                                         |
| 8              | 呼び出し側の認証方式（ヘッダーベースの識別子等）が署名検証を伴わない場合がある                                  | ライブラリ側の制約ではなく、呼び出し側アプリの認証方式の限界として認識する事項                                                                                                                                                        |
| 9              | `process-handler`が失敗・タイムアウトした場合、`failed`レコードが作られずクライアントが永久にポーリングし続ける | `process-handler`にLambda非同期呼び出しの`on-failure`宛先（SQS DLQ）を設定し、DLQ経由で`failed`レコードを書き込む後続処理を追加する                                                                                                   |
| 10             | presign発行時のアップロード権限チェック                                                                         | ライブラリはこの判断を持たない。呼び出し側が自身のビジネスロジックでpresign発行前に権限チェックを行うことを前提とする                                                                                                                 |
| 11             | 画像配信CDNに認証が全くない                                                                                     | CloudFront署名付きURL（trusted key group）を必須にする                                                                                                                                                                                |
| 12             | 署名付きURLの有効期限とアプリ側キャッシュの不整合                                                               | クライアント側の画像キャッシュキーは署名パラメータを含めない値（`{fileId}-{width}`等）にする。アプリ側キャッシュの有効期限は署名URLの有効期限より必ず短くする                                                                         |
| 13             | オンデマンドリサイズの悪用（任意幅の大量リクエストによるコスト増）                                              | 署名は呼び出し時点で確定した具体的な幅に対して発行する（ワイルドカード署名はしない）。加えて`media-handler`が`1 <= width <= masterMaxDimension`を健全性チェックとして検証する。リサイズキャッシュはS3 Lifecycleで自動的に有限化される |
| 14（Critical） | 署名付きURLを永続フィールドにそのまま書き込むと、期限切れ後に壊れたリンクになる                                 | 呼び出し側は「安定した参照（fileId）」と「表示専用の解決済みURL（応答専用、永続化しない）」を分離すること                                                                                                                             |
| 15（Critical） | `media-handler`のFunction URLが`NONE`だと、CloudFrontを経由せず直接叩くことで署名検証を迂回できる               | Function URLを`AWS_IAM`にし、CloudFront用OAC（lambdaタイプ）＋`aws_lambda_permission`（principal=cloudfront、source_arn=Distribution ARN）で保護する                                                                                  |
| 16（Major）    | Lambda Function URLの応答サイズ上限（バッファ型で約4.4MB相当）に大きいmaster・非画像ファイルが収まらない可能性  | masterの配信（`width`省略時）はS3オリジン（OAC）から直接行い、Lambdaを経由させない。Lambdaオリジンはリサイズ（`/resize/*`、幅を絞ったサイズのみ）専用にする                                                                           |
| 17（Minor）    | 404応答がCloudFrontのネガティブキャッシュ（既定約10秒）で意図せず長引く                                         | エラー応答に`Cache-Control: no-store`を付け、`custom_error_response`の`error_caching_min_ttl`を0にする                                                                                                                                |
| 18（Minor）    | 署名のたびに`Expires`が変わり、同じ画像への短時間の再取得でもブラウザキャッシュが効かない                       | `Expires`を1時間単位等に切り上げてから署名し、同一時間帯内は同じURLになるようにする                                                                                                                                                   |

## メタデータ管理（DynamoDB方式）

**image policyの型**（`upload-handler`・`process-handler`・`media-handler`がParameter Storeから実行時取得するJSON。前述「image policyの管理」参照）:

```ts
interface ImagePolicy {
  masterMaxDimension: number; // process-handlerがmaster生成時に使う長辺上限。
  // media-handlerのwidth健全性チェックの上限もこの値を流用する
  // （下限は固定`1`。署名付きURL必須のため独立フィールドは持たない）
  allowedContentTypes: string[]; // upload-handlerがpresign発行時に使う許可MIMEタイプ
  maxUploadSize: number; // upload-handlerがpresign発行時に使う最大アップロードサイズ
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

## コンポーネント一覧（`src/server/media/`）

- `presign.ts`: `generatePresignedUpload({ s3Client, bucket, contentType, originalFilename, fileSize, allowedContentTypes, maxUploadSize, metadata })` — DynamoDBには一切触れない。`metadata`の各キーを`x-amz-meta-{key}`としてpolicyの`eq`条件に固定する。ULID採番、`{ fileId, uploadUrl, fields }`を返す。`exports`の`./server/media/presign`として公開。
- `upload-handler.ts`: `POST /presign`・`POST /sign`（署名付きURL発行、`{fileId, width?}[]`のバッチAPI）を扱うLambda Function URL用ハンドラ。呼び出し側の認証方式（JWT等）に応じた検証は呼び出し側が用意した認証ユーティリティを再利用する想定。**image policy（後述、`allowedContentTypes`・`maxUploadSize`等）はParameter Storeから実行時に取得**し、`presign.ts`呼び出し時の引数として渡す（Terraform環境変数には焼き込まない。ポリシー変更にインフラデプロイを不要にするため）。署名生成は`sign.ts`を呼ぶ。`exports`の`./server/media-upload-handler`として公開。
- `sign.ts`: `signMediaUrl({ fileId, width?, keyPairId, privateKey, baseUrl, expiresInSeconds })` — Canned Policyで署名付きURLを生成する共通ロジック。`width`指定時は`/resize/{fileId}?width=N`、省略時は`/master/{fileId}`のURLに署名する（**呼び出し元が具体的な幅を決めてから呼ぶ**。ワイルドカード署名はしない）。`Expires`は指定した粒度（例: 1時間）に切り上げてから署名する。秘密鍵の取得はこの関数の責務外とし、引数で受け取るだけにする。`exports`の`./server/media-sign`として公開。
- `process-handler.ts`: S3 `ObjectCreated`イベント（`raw/*`）をトリガーに起動。HeadObjectでメタデータ取得→マジックナンバー検証→`contentType`で分岐:
  - 画像（svg除く）: sharp: rotate()（EXIF Orientationに基づく向き補正）→ 長辺がimage policy（Parameter Storeから実行時取得、既定4096px）の`masterMaxDimension`を超える場合のみresize → strip metadata → jpeg（limitInputPixelsで巨大画像を拒否）→ `master/{fileId}`へ配置
  - 非画像: CopyObject（MetadataDirective:REPLACEでContent-Disposition/Content-Typeを明示設定）→ `master/{fileId}`へ配置（単一ファイル、リサイズキャッシュ概念なし）
  - 最後に`updateOne`操作（`upsert:true`、テーブル名は環境変数`TABLE_NAME`）で呼び出し側の既存テーブルにレコードを作成/更新
  - **失敗時のハンドリング**: Lambda非同期呼び出しの`on-failure`宛先としてSQS DLQを設定する。例外・タイムアウトでリトライが尽きた場合、DLQをトリガーに起動する小さなハンドラ（`process-handler-dlq.ts`）が`status:'failed'`レコードを書き込む。
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
- S3イベント通知（`raw/*` ObjectCreated → `process-handler` Lambda）
- SQS DLQ（`process-handler`の`on-failure`宛先）
- `upload-handler` Lambda（presign + `/sign`、Function URL、認証は呼び出し側の認証方式に依存。SSMから署名用秘密鍵・image policyを取得するため`ssm:GetParameter`権限が必要）
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

## 関連ADR

- [0001-fix-iam-auth-bypass.md](adr/0001-fix-iam-auth-bypass.md): メディア機能実装前提として先に修正した、汎用CRUD LambdaのIAM認証バイパス脆弱性
- メディア機能固有の設計判断（別テーブルを作らない理由、presign時にDBへ書き込まない理由、オンデマンドリサイズ＋署名付きURLを採用した経緯、master/resizeビヘイビア分割の理由、条件付き書き込みが無い制約）は別途ADRとして記録する
