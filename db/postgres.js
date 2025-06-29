// db/postgres.js
// PostgreSQL connection module using pg Pool

const { Pool } = require('pg');

// Connection pool configuration - reads from environment variables
// These variables should be set in your Cloud Run service configuration
const config = {
  user: process.env.DB_USER, // e.g., 'postgres'
  password: process.env.DB_PASSWORD, // The password for your Cloud SQL user
  database: process.env.DB_NAME, // The database name you created in Cloud SQL
  // host: Specifies the connection path.
  // For Cloud Run connecting via Cloud SQL Auth Proxy (recommended):
  // Use the Unix socket path provided by the proxy.
  // Format: /cloudsql/INSTANCE_CONNECTION_NAME
  // INSTANCE_CONNECTION_NAME is like 'your-project-id:your-region:your-instance-id'
  host: process.env.DB_SOCKET_PATH || `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,

  // Optional settings for the connection pool
  max: 10, // Max number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 5000, // How long to wait trying to connect before timing out
};

// Basic validation to ensure essential environment variables are set
// Helps catch configuration errors early during container startup
if (!config.user || !config.password || !config.database || !config.host || !config.host.includes(process.env.INSTANCE_CONNECTION_NAME)) {
  console.error('FATAL ERROR: Database configuration environment variables missing or incomplete.');
  console.error('Required: DB_USER, DB_PASSWORD, DB_NAME, INSTANCE_CONNECTION_NAME (used to build DB_SOCKET_PATH)');
  // Optional: Exit if configuration is critically missing, preventing the app from starting incorrectly
  // process.exit(1);
} else {
    console.log(`Database config loaded: user=${config.user}, db=${config.database}, host=${config.host}`);
    // Avoid logging password!
}


// Create the connection pool
const pool = new Pool(config);

// Optional: Event listener for new client connections
pool.on('connect', (client) => {
  console.log('Database client connected to pool.');
  // You could set session parameters here if needed, e.g.:
  // client.query('SET TIME ZONE "UTC";');
});

// Optional: Event listener for errors on idle clients
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client', err);
  // Consider if this error should terminate the application
  // process.exit(-1);
});

console.log("PostgreSQL connection pool initialized.");

// Export methods for interacting with the database
module.exports = {
  // Method to execute a query directly using the pool
  // Suitable for single queries where transaction management isn't needed
  query: (text, params) => pool.query(text, params),

  // Method to get a client from the pool
  // Necessary for running multiple queries within a transaction
  getClient: () => pool.connect(),

  // Export the pool itself if direct access is needed elsewhere (use with caution)
  pool: pool
};
