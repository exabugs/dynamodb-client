/**
 * presign発行（S3 Presigned POST）
 *
 * DynamoDBには一切触れない（詳細: docs/media-design.md 設計方針2）。
 * アップロードされたオブジェクトのメタデータは、クライアントが自由に指定できる値では
 * なく、ここでpolicyのeq条件として固定した値のみを許可する（サーバー側が値を強制する）。
 */
import { ulid } from 'ulid';

import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

import type { PresignedUploadParams, PresignedUploadResult } from './types.js';

const DEFAULT_EXPIRES_IN_SECONDS = 300;

// @aws-sdk/s3-presigned-post は Conditions の要素型を公開exportしていないため、
// createPresignedPost 自体のパラメータ型から導出する
type PresignCondition = NonNullable<Parameters<typeof createPresignedPost>[1]['Conditions']>[number];

/**
 * S3はユーザー定義メタデータのキーを常に小文字で保存する（AWS仕様）。
 * ここで大文字混じりのキーを許可すると、アップロード時に指定したキー名と
 * process-handlerがHeadObjectで読み戻すキー名が一致しなくなり、呼び出し側の
 * 権限スコープ判定（例: ownerIdでのフィルタ）がサイレントに失敗する。
 * 呼び出し側の実装ミスを早期に検出するため、小文字以外のキーは拒否する。
 */
const METADATA_KEY_PATTERN = /^[a-z0-9-]+$/;

function validateMetadataKeys(metadata: Record<string, string>): void {
  for (const key of Object.keys(metadata)) {
    if (!METADATA_KEY_PATTERN.test(key)) {
      throw new Error(
        `Invalid metadata key "${key}": S3 lowercases metadata keys, so keys must already be ` +
          `lowercase (and use only [a-z0-9-]) to avoid a silent mismatch after upload`
      );
    }
  }
}

/**
 * presign付きアップロードURLを発行する
 *
 * @throws contentTypeがallowedContentTypesに含まれない場合
 * @throws fileSizeがmaxUploadSizeを超える場合
 */
export async function generatePresignedUpload(
  params: PresignedUploadParams
): Promise<PresignedUploadResult> {
  const {
    s3Client,
    bucket,
    contentType,
    originalFilename,
    fileSize,
    allowedContentTypes,
    maxUploadSize,
    metadata,
    expiresInSeconds,
  } = params;

  if (!allowedContentTypes.includes(contentType)) {
    throw new Error(`Content type not allowed: ${contentType}`);
  }
  if (fileSize <= 0 || fileSize > maxUploadSize) {
    throw new Error(`File size out of range: ${fileSize} (max: ${maxUploadSize})`);
  }
  validateMetadataKeys(metadata);

  const fileId = ulid();
  const key = `raw/${fileId}`;

  const conditions: PresignCondition[] = [
    ['content-length-range', 1, maxUploadSize],
    { 'Content-Type': contentType },
  ];
  const fields: Record<string, string> = {
    'Content-Type': contentType,
  };

  for (const [metaKey, metaValue] of Object.entries(metadata)) {
    const fieldName = `x-amz-meta-${metaKey}`;
    fields[fieldName] = metaValue;
    conditions.push({ [fieldName]: metaValue });
  }

  if (originalFilename) {
    fields['x-amz-meta-original-filename'] = originalFilename;
    conditions.push({ 'x-amz-meta-original-filename': originalFilename });
  }

  const { url, fields: presignedFields } = await createPresignedPost(s3Client, {
    Bucket: bucket,
    Key: key,
    Conditions: conditions,
    Fields: fields,
    Expires: expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS,
  });

  return {
    fileId,
    uploadUrl: url,
    fields: presignedFields,
  };
}
