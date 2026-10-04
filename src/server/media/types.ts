/**
 * メディア機能の型定義
 *
 * 詳細設計: docs/media-design.md
 */
import type { S3Client } from '@aws-sdk/client-s3';

/**
 * メディアレコードの処理状態
 *
 * `pending`は存在しない。レコードが無ければ処理中を意味する
 * （presign発行時点ではDynamoDBに触れない設計のため）。
 */
export type MediaStatus = 'completed' | 'failed';

/**
 * メディアレコード（共通フィールドのみ）
 *
 * アプリ固有の追加フィールドは、process-handlerがS3オブジェクトメタデータから
 * 読み取った値をそのまま書き込む（本型はフィールド名を規定しない）。
 */
export interface MediaRecord {
  /** fileId（ULID） */
  id: string;
  status: MediaStatus;
  /** アップロード時に申告され、実バイトと照合済みのMIMEタイプ */
  contentType: string;
  /**
   * masterとして実際に保存される形式（画像なら'image/jpeg'、それ以外はcontentTypeと同じ）。
   * contentTypeとの不一致を明示的に区別する
   */
  outputContentType: string;
  originalFilename?: string;
  /** master（画像の場合のみ）の寸法 */
  dimensions?: { width: number; height: number };
  /** masterのファイルサイズ（バイト） */
  size?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

/**
 * image policy（Parameter Store経由で実行時取得するJSON）
 *
 * 呼び出し側のpresign発行処理（allowedContentTypes/maxUploadSize）、
 * process-handler（masterMaxDimension）、
 * media-handler（widthの健全性チェック上限として masterMaxDimension を流用）が参照する。
 *
 * 下限は固定 `1`（独立フィールドは持たない。署名付きURL必須のため、
 * 健全性チェック以外の制約は不要という設計判断。詳細: docs/media-design.md）。
 */
export interface ImagePolicy {
  /** process-handlerがmaster生成時に使う長辺上限。media-handlerのwidth上限チェックにも流用する */
  masterMaxDimension: number;
  /** presign発行時に使う許可MIMEタイプ */
  allowedContentTypes: string[];
  /** presign発行時に使う最大アップロードサイズ（バイト） */
  maxUploadSize: number;
}

/**
 * generatePresignedUpload の引数
 */
export interface PresignedUploadParams {
  s3Client: S3Client;
  bucket: string;
  contentType: string;
  originalFilename?: string;
  fileSize: number;
  allowedContentTypes: string[];
  maxUploadSize: number;
  /** x-amz-meta-{key} としてpolicyのeq条件に固定するアプリ固有メタデータ */
  metadata: Record<string, string>;
  /** presigned POSTの有効期限（秒）。省略時は300秒 */
  expiresInSeconds?: number;
}

/**
 * generatePresignedUpload の戻り値
 */
export interface PresignedUploadResult {
  fileId: string;
  uploadUrl: string;
  fields: Record<string, string>;
}

/**
 * signMediaUrl の引数
 */
export interface SignMediaUrlParams {
  fileId: string;
  /** 指定時は /resize/{fileId}?width=N、省略時は /master/{fileId} に署名する */
  width?: number;
  keyPairId: string;
  privateKey: string;
  baseUrl: string;
  /** 有効期限（秒）。Expiresはこの粒度に切り上げてから署名する */
  expiresInSeconds: number;
}

/**
 * signMediaUrl の戻り値
 */
export interface SignMediaUrlResult {
  fileId: string;
  width?: number;
  url: string;
  /** 署名に使ったExpires（epoch seconds、丸め込み後） */
  expiresAt: number;
}
