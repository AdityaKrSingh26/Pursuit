import { v2 as cloudinary } from 'cloudinary'
import { env } from './env.js'

let _cloudinaryConfigured = false

function getCloudinary() {
  if (_cloudinaryConfigured) return cloudinary
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return null
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  _cloudinaryConfigured = true
  return cloudinary
}

export async function uploadBuffer(key, buffer, contentType) {
  const client = getCloudinary()
  if (!client) {
    console.warn('[storage] Cloudinary not configured, skipping upload')
    return
  }

  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        public_id: key,
        resource_type: 'raw',
      },
      (error, result) => {
        if (error) {
          console.error('[storage] Cloudinary upload failed:', error)
          return reject(error)
        }
        resolve(result)
      }
    )
    stream.end(buffer)
  })
}

export async function getSignedUrl(key, expirySeconds = 300) {
  const client = getCloudinary()
  if (!client) {
    console.warn('[storage] Cloudinary not configured, returning null URL')
    return null
  }

  // Generate and return the secure delivery URL for the raw asset
  return client.url(key, {
    secure: true,
    resource_type: 'raw',
  })
}
