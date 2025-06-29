module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-very-strong-secret-key-for-dev-only',
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'your-gcs-bucket-name'
};