# Stage 1: Install production dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Use npm ci for reproducible builds based on package-lock.json
RUN npm ci --only=production

# Stage 2: Setup runtime environment
FROM node:22-alpine AS runtime
WORKDIR /app

# Copy dependencies from 'deps' stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
# Ensure your code (e.g., db/postgres.js) reads env vars like
# INSTANCE_CONNECTION_NAME, DB_USER, DB_PASSWORD, DB_NAME, DB_SOCKET_PATH
COPY . .

# Set default port (Cloud Run will override with its own PORT env var)
ENV PORT=8080
EXPOSE 8080

# Command to run the application directly
# Node.js will read environment variables provided by Cloud Run
CMD ["node", "index.js"]

# ENTRYPOINT script is likely no longer needed if it only started the proxy