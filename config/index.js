const dotenv = require('dotenv');

// Load environment variables from a .env file if present
dotenv.config();

const requiredVars = ['JWT_SECRET', 'GCS_BUCKET_NAME'];

for (const name of requiredVars) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME
};
