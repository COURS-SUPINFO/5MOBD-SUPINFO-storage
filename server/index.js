const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const {
  // The client (app) performs the actual PUT/GET, so the URLs we sign/build must use the
  // endpoint the CLIENT can reach, not this container's internal Docker-network address.
  MINIO_PUBLIC_ENDPOINT = 'http://localhost:9000',
  MINIO_ACCESS_KEY = 'minioadmin',
  MINIO_SECRET_KEY = 'minioadmin123',
  MINIO_BUCKET = 'mesbonnesadresses',
  PORT = 4000,
} = process.env;

const s3 = new S3Client({
  endpoint: MINIO_PUBLIC_ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY },
  forcePathStyle: true, // required for MinIO (and any non-AWS S3-compatible endpoint)
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Hands the client a short-lived, single-object PUT URL instead of the storage secret key.
// The client uploads the file directly to MinIO with that URL, then saves the returned
// `publicUrl` (the bucket is configured read-only-public by docker-compose's minio-init step).
//
// NOTE: this endpoint does not verify a Firebase ID token before signing - anyone who can
// reach it can request an upload URL for any path. That's an acceptable simplification for
// a local, non-deployed docker-compose stack used in development/grading, but it would need
// real auth (e.g. verifying the Firebase ID token) before ever being exposed publicly.
app.post('/presign', async (req, res) => {
  const { path, contentType } = req.body ?? {};

  if (typeof path !== 'string' || path.length === 0 || path.includes('..')) {
    res.status(400).json({ error: 'Invalid "path".' });
    return;
  }

  try {
    const command = new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: path,
      ContentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `${MINIO_PUBLIC_ENDPOINT}/${MINIO_BUCKET}/${path}`;

    res.json({ uploadUrl, publicUrl });
  } catch (error) {
    console.error('Failed to presign upload URL:', error);
    res.status(500).json({ error: 'Could not create an upload URL.' });
  }
});

app.listen(PORT, () => {
  console.log(`Upload API listening on port ${PORT}`);
});
