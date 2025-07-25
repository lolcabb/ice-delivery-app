const dotenv = require('dotenv');

// Load environment variables from a .env file if present
dotenv.config();

function getConfig() {
  const required = ['JWT_SECRET', 'GCS_BUCKET_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'INSTANCE_CONNECTION_NAME'];
  required.forEach(name => {
    if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
  });
  return {
    JWT_SECRET: process.env.JWT_SECRET,
    GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    INSTANCE_CONNECTION_NAME: process.env.INSTANCE_CONNECTION_NAME,
    DB_SOCKET_PATH: process.env.DB_SOCKET_PATH
  };
}

module.exports = { getConfig };
