import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2_BUCKET_NAME environment variable is required.');
  }
  return bucket;
}

export async function putObject(key: string, body: Buffer, contentType?: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getObject(key: string): Promise<Buffer> {
  const client = getR2Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`Empty response body for object: ${key}`);
  }

  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}

const PROFILE_PHOTO_URL_TTL = 24 * 60 * 60; // 24 hours
const DOCUMENT_URL_TTL = 5 * 60; // 5 minutes

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number = DOCUMENT_URL_TTL
): Promise<string> {
  const client = getR2Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

// In-process presigned URL cache. Keyed by R2 object key.
// Caches for 23 hours when URL expiry is 24 hours — avoids
// regenerating URLs on every cleaner card render on /cleaners.
const urlCache = new Map<string, { url: string; expiresAt: number }>();

const CACHE_MARGIN_MS = 60 * 60 * 1000; // 1 hour before URL expiry

export async function getCachedPresignedUrl(
  key: string,
  expiresInSeconds: number = PROFILE_PHOTO_URL_TTL
): Promise<string> {
  const now = Date.now();
  const cached = urlCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  const url = await getPresignedDownloadUrl(key, expiresInSeconds);
  const cacheExpiresAt = now + expiresInSeconds * 1000 - CACHE_MARGIN_MS;
  urlCache.set(key, { url, expiresAt: cacheExpiresAt });

  return url;
}

// Periodic cleanup of expired cache entries
setInterval(() => {
  const now = Date.now();
  urlCache.forEach((entry, key) => {
    if (entry.expiresAt < now) {
      urlCache.delete(key);
    }
  });
}, 10 * 60 * 1000);

/**
 * Resolves a User.image value to a displayable URL.
 * - R2 object keys (e.g. "profile-photos/abc.jpg") → cached presigned URL
 * - Legacy base64 data URLs → passed through
 * - HTTP(S) URLs → passed through
 * - null/empty → returns null
 */
export async function resolveProfileImageUrl(imageValue: string | null | undefined): Promise<string | null> {
  if (!imageValue) return null;
  if (imageValue.startsWith('data:') || imageValue.startsWith('http')) return imageValue;

  try {
    return await getCachedPresignedUrl(imageValue);
  } catch {
    return null;
  }
}
