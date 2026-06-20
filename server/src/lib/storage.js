import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from './env.js'

function getClient() {
  if (!env.STORAGE_ENDPOINT || !env.STORAGE_KEY || !env.STORAGE_SECRET) {
    return null
  }
  return new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: env.STORAGE_KEY,
      secretAccessKey: env.STORAGE_SECRET,
    },
    region: 'auto',
    forcePathStyle: true, // required for MinIO and R2
  })
}

export async function uploadBuffer(key, buffer, contentType) {
  const client = getClient()
  if (!client) {
    console.warn('[storage] STORAGE_ENDPOINT not configured, skipping upload')
    return
  }
  await client.send(
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )
}

export async function getSignedUrl(key, expirySeconds = 300) {
  const client = getClient()
  if (!client) {
    console.warn('[storage] STORAGE_ENDPOINT not configured, returning null URL')
    return null
  }
  const command = new GetObjectCommand({
    Bucket: env.STORAGE_BUCKET,
    Key: key,
  })
  return awsGetSignedUrl(client, command, { expiresIn: expirySeconds })
}
