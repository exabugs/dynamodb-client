# ADR 0002: メディア（ファイルアップロード/配信）機能の設計方針

## ステータス

承認・設計確定（実装はPhase M1として着手中）

**2026-10-05改訂**: 実装レビュー・設計レビュー（いずれも第三者によるアドバーサリアルレビュー）で、Critical 4件・Major 10件の欠落が見つかり、設計書（`media-design.md`）を改訂した。要点は以下「2026-10-05の改訂内容」を参照。改訂前の設計のまま実装を続けることはできないと判断されていた。

## 背景

利用アプリ側から、画像等のファイルをアップロード・処理（EXIF除去・リサイズ）・配信する機能を本ライブラリに追加してほしいという要望があった。設計にあたり、以下の制約・要件を踏まえる必要があった。

- 専用テーブルを新設するのではなく、利用アプリが既に持つSingle-Tableに相乗りできること
- 「誰が・何を・アップロード/閲覧して良いか」という認可判断はアプリごとに異なるため、本ライブラリが持つべきではない
- 画像処理はオプションであり、非画像ファイルの保存・配信もサポートすること
- 本ライブラリの`updateOne`/`updateMany`には条件付き書き込みが無いため、この制約を前提に設計すること（[0001](0001-fix-iam-auth-bypass.md)の調査で判明した`handleUpdateMany`の非アトミック性も踏まえる）

複数回の設計レビューを経て、以下の点で当初案から転換した:

1. **別テーブル・別CRUD Lambdaを新設する案を撤回**し、既存テーブルへの相乗りに変更（利用アプリ側のリソース横断ロジックへの影響を避けるため）
2. **presign発行時に`pending`レコードをDynamoDBに作成する案を撤回**し、S3イベント駆動でレコードを作る方式に変更（TTLの粒度不足・利用アプリの書き込み権限不要化のため）
3. **画像配信のCDN認証を追加**（当初案には無かったが、認証の無いCDN配信は重大な欠陥のため必須化）

## 決定

詳細設計は[media-design.md](../media-design.md)に記載する（アプリ非依存の汎用設計のため、本ADRから分離）。ここでは設計判断の要点のみ記す。

### 1. 既存テーブルへの相乗り（専用テーブルを持たない）

`media`という1リソースとして、利用アプリの既存DynamoDBテーブルに相乗りする。テーブル名/ARNは呼び出し側がTerraform変数で渡す。個別取得・一覧取得は呼び出し側の既存の認可レイヤーにそのまま乗せることを推奨する。

### 2. presign発行時点ではDynamoDBに触れない

S3 Presigned POSTのpolicyでメタデータを`eq`条件固定した上でpresignのみ発行し、DynamoDBには触れない。S3 `ObjectCreated`イベントをトリガーに`process-handler`が初めてDynamoDBレコードを作成する。これにより、アップロードされなかった/失敗したファイルの痕跡（pending放置レコード）がそもそも発生しない設計にした。

### 3. 配信はオンデマンドリサイズ＋CloudFront署名付きURL

`raw/{fileId}`（生データ、非公開）・`master/{fileId}`（EXIF除去済みオリジナル、恒久保存）・`cache/{fileId}/{width}`（オンデマンド生成、Lifecycleで自動削除）の3層構造にする。masterはS3から直接配信（Lambda非経由、応答サイズ上限を回避）、リサイズのみmedia-handler Lambda経由にする。認証はCloudFrontのネイティブ署名付きURL（`trusted_key_groups`）を採用し、「誰に署名URLを発行するか」の判断は利用アプリに委ねる。

### 4. 条件付き書き込みが無い制約への対応

`process-handler`は`insertOne`ではなく`updateOne`+`upsert:true`を使う（S3イベントの重複配信に対する冪等性確保のため）。本ライブラリに条件付き書き込みが無いという制約上、厳密な排他制御はできないが、同一`fileId`への冪等な上書きになるため実害は小さいと判断した。

## 影響・トレードオフ

- 本ライブラリは「誰が・何を見て良いか」の認可判断を一切持たないため、利用アプリは署名URL発行APIを自前で用意する必要がある（本ライブラリは署名生成ロジックのみ提供）
- S3イベント重複時の厳密な排他制御ができない制約は、本ライブラリの`updateOne`に条件付き書き込みが追加されるまで残る既知の制約
- 既存の`handleUpdateMany`の非アトミック性（[0001](0001-fix-iam-auth-bypass.md)とは別に判明していた、`id`以外のフィルタでの`find`ベース存在確認の限界）は、`process-handler`では`id`（`fileId`）での`updateOne`に限定することで回避している

## 2026-10-05の改訂内容（設計レビューへの対応）

実装後の第三者レビュー（アドバーサリアル）で、設計書自体の欠落に起因するCritical 4件・Major 10件が見つかった。詳細な指摘内容と修正方針は[media-design.md](../media-design.md)の各該当箇所（2026-10-05改訂・2026-10-05追加と注記した部分）に統合した。主な変更点:

1. **S3メタデータの契約を明文化**（Critical）: S3がメタデータキーを小文字化する仕様に対し、呼び出し側のキー設計がサイレントに壊れる問題があった。小文字限定のキー形式・予約キー拒否・値のASCII制約・合計サイズ上限（2KB）をライブラリ側で検証するよう設計を追加し、`presign.ts`に実装済み。
2. **upload-handler.tsを復活**（Critical）: 「呼び出し側は既存HTTPレイヤーから`presign.ts`/`sign.ts`を直接呼ぶため不要」と判断し一度削除したが、**同一アプリ内でも認証方式が異なる複数クライアント（例: モバイルBFFとは別に、Cognito JWTを使う管理画面）を持つ場合、対応する既存HTTPレイヤーが無いことがある**という設計漏れが判明した。`createUploadHandler()`ファクトリとして復活させ、このようなケース専用の独立Lambdaを構築できるようにした。
3. **S3 CORS設定を追加**（Critical）: ブラウザからのpresigned POSTアップロードにはCORSが必須だが設計に無かった。`allowed_upload_origins`変数を追加。
4. **presigned POST再利用・master不変性の残存リスクを明文化**（Critical）: 条件付き書き込みが無い制約上、完全な解決はできないが、影響範囲が自分自身のデータに閉じることを明記し、許容可能な残存リスクとして文書化した。
5. **リサイズのサイズ設計を修正**（Major）: `masterMaxDimension`が長辺の「上限」であって実際の寸法でないことを見落とし、アップスケール・Lambda応答サイズ超過（502）の問題があった。`withoutEnlargement: true`（実装済み）とmedia-handlerでの品質段階的フォールバックを設計に追加。
6. **DLQ経由のfailedレコードにメタデータが欠落する問題**（Major）: DLQハンドラがHeadObjectでメタデータを読み直すよう設計を追加。
7. **エラー分類を明文化**（Major）: 検証エラー（即`failed`書き込み）とインフラ障害（例外→リトライ→DLQ）を区別する方針を明記。
8. **ポーリングの状態区別・タイムアウト**（Major）: 「0件」が複数の異なる状態を一括りにしている問題に対し、クライアント側タイムアウトと`maximum_event_age_in_seconds`の設定値を明記（Terraformに反映済み）。
9. **Shadow Records設定の受け渡し手段を追加**（Major）: `terraform/media/variables.tf`に`shadow_*`変数を追加し、`process-handler`・`process-handler-dlq`の環境変数として配線（実装済み）。
10. **本体のID直引き経路のスコープ無視問題は未解決のまま**（Major）: 修正されるまで、権限スコープ付きポーリングでのID直引き最適化は使えないことを明記。別途本体側で対応要。
11. **`process-handler`のアーキテクチャ層バイパスは構造上やむを得ない設計判断として明記**（Major）: presign時の`pending`レコード案を撤回した理由と同種の懸念だが、S3イベント駆動処理の性質上、呼び出し側の層構造には乗せられないため許容する。

## 2026-10-05追記: presign有効期限（TTL）の既定値訂正

上記4番（presigned POST再利用リスク）の軽減策として「TTLは必要最小限（既定300秒）に保つ」と記載していたが、この300秒という数値自体の根拠を検証していなかった（「アップロード転送時間を確保するため」という誤った前提で設定していた）。指摘を受けて以下を確認・決定した。

- **確認した事実**: AWS公式ドキュメント（[Presigned URL expiration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)）に、presigned URL（GET/PUT）の`expiration`はリクエスト**開始時点**でのみ判定され、転送開始後に期限が切れても転送自体は継続すると明記されている。presigned POSTについて同一の記述は見つからなかったが、policyフィールドがファイル本体より先にリクエストに含まれる仕様上、同様の挙動と推定される（**本番投入前に実機で確認すること**）。
- **この事実の帰結**: TTLがカバーすべきは「ファイル転送時間」ではなく、「presignを受け取ってから実際にPOSTを開始するまでの間隔」である。presignはアップロード開始直前に発行する設計を前提とするため、この間隔は悪条件のモバイル回線（DNS・TCP/TLSハンドシェイクのSYN再送込み）でも数秒〜10秒程度に収まる。
- **決定**: 既定値を**30秒**に変更する（悪条件時の想定遅延の約3倍の余裕）。あわせて、**失敗時は理由を問わず同じpresignで再試行せず、必ず新しいpresignを取り直す**という設計原則を明記する（TTLの長さをリトライ回数・間隔から独立させ、設計をシンプルに保つため）。
- **4番（再利用リスク）の軽減策の訂正**: TTLの長さは、このリスクへの主たる対策ではないと判明した。実質的な対策は(1)`fileId`の一意性（ULID）、(2)`content-length-range`・`Content-Type`のpolicy条件、(3)アップロード後のサーバー側検証（マジックナンバー照合）の3点であり、いずれも実装済み。TTLを極端に短くしてもこのリスク自体はほとんど縮小しないため、30秒という値は「再利用リスクの軽減」ではなく「正当なアップロード開始までの遅延を安全にカバーする」という別の目的のために設定する。
- 実装: `src/server/media/presign.ts`の`DEFAULT_EXPIRES_IN_SECONDS`を30に変更済み。

## 2026-10-05追記: 実装レビュー指摘のうち未反映だった項目の監査と残りの設計決定

設計書・本ADRには決定事項を記録したが、コードへの反映を確認せず「対応済み」として扱っていた項目が複数あった。監査の結果、以下は**設計判断を伴わない単純な実装ミス・未着手**であり、ADR追記なしに直接修正する:

- `magicBytes.ts`のGIF判定: `SIGNATURES`配列に対して`.every()`（全件AND）を使っていたため、GIF87a/GIF89aという**互いに排他的な2つの代替パターン**を両方満たすことを要求してしまい、実在するGIFファイルが常に一致しない（＝常にfailedになる）バグがあった。「代替候補のいずれか一致（OR）」と「1候補内の複数条件はすべて一致（AND、WebPのRIFF+WEBP識別子のケース）」を区別する実装に修正する。
- `dynamodb:DeleteItem`のIAM権限欠落: `updateMany`はTransactWriteの中で古いShadow Recordを削除する処理を含むため、`process-handler`・`process-handler-dlq`のIAMロールに`dynamodb:DeleteItem`が無いと2回目以降の更新がAccessDeniedになる。権限を追加する。
- DLQでのメタデータ再取得・日本語ファイル名のRFC 6266エンコード・media-handlerの品質段階的フォールバック: 設計書に決定事項として既に記載済み（本ADR2026-10-05改訂の6番、media-design.md「メタデータの契約」「リサイズのサイズ設計」参照）だが、コード実装が漏れていた。設計の再検討は不要で、記載済みの決定に従って実装する。

以下2点は**新たな設計判断を伴う**ため、ここに記録してから実装する:

### 非画像ファイルのマジックナンバー検証（Range GET化）

`process-handler`は、マジックナンバー照合のためだけに非画像ファイルも含めて`GetObjectCommand`で全量を読み込んでいた。`maxUploadSize`に明確な上限はあるが、大きな動画・PDF等では不要にメモリを消費する（Lambdaメモリ1024MBに対し、巨大ファイルでOOMのリスク）。

**決定**: マジックナンバー照合に必要な先頭バイト数（現状の照合表で最大12バイト程度、将来の拡張を見込んで余裕を持たせ256バイト）のみを`Range: bytes=0-255`ヘッダー付きの`GetObjectCommand`で取得して検証する。検証を通過した後、画像処理（sharp）が必要な場合のみ、あらためて全量を取得する（非画像の場合はCopyObjectで足りるため全量取得が不要なのは既存の設計通り）。2回に分けてGetObjectすることになるが、画像の場合は元々sharp処理に全量が必要なため追加コストは小さく、非画像の場合はこの256バイトの取得だけで完結し、大幅にメモリ効率が改善する。

### CloudFront→media-handlerのLambda呼び出し権限

**2026-10-05訂正（初版は誤り）**: 初版では「AWSの要求が文書上曖昧」「時期・リージョンで挙動が違う」として不確実性を理由に両方のactionを付与するとしていたが、これは未検証の推測だった（Opusレビューで指摘）。実際にはAWSがLambda Function URL + OAC経由の呼び出しに対し**Dual Auth（`lambda:InvokeFunctionUrl`と`lambda:InvokeFunction`の両方の許可）を正式に要求する仕様変更を導入済み**であり、ドキュメントに明記されている（[AWS公式ドキュメント](https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html)）。移行猶予期間は**2026-11-01**に終了し、それ以降`lambda:InvokeFunctionUrl`のみでは`/resize/*`が全件403になる（CDK・Terraform AWS Providerの双方で同種の不足が報告・修正されている: [aws-cdk#35872](https://github.com/aws/aws-cdk/issues/35872)、[terraform-provider-aws#44829](https://github.com/hashicorp/terraform-provider-aws/issues/44829)）。

**決定**: 両方の`action`を付与するのは「念のための安全策」ではなく**AWSの正式要件への準拠として必須**。`lambda:InvokeFunction`側の`aws_lambda_permission`には、AWS推奨の`invoked_via_function_url = true`を指定し、この許可をFunction URL経由の呼び出しに限定する（Terraform AWS Provider 6.67.0で対応済みの属性）。「dev環境で実地検証後に不要な方を外す」という初版の計画は撤回する（猶予期間終了後に外すと障害になるため）。検証タスクは「`InvokeFunctionUrl`だけで403になることの確認」ではなく、**両方付与した構成で`/resize/*`が実際に200を返すことの確認**に変更する。

**セキュリティ補足**: principal `cloudfront.amazonaws.com`は他サービスが詐称できず、`source_arn`でこのDistribution 1つに限定されているため、confused deputy対策は担保されている。CloudFrontがFunction URLを経由せず素の`Invoke` APIを叩く経路は存在しないため、`lambda:InvokeFunction`の追加付与自体が新たな攻撃面を開くことはない。
