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

  const fileId = ulid();
  const key = `raw/${fileId}`;

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const conditions: any[] = [
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
