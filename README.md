# Ice Delivery App

This application loads configuration from environment variables via `getConfig()`
located in `config/index.js`. Ensure all required variables are defined **before**
any code calls `getConfig()`.

Required variables:
- `JWT_SECRET`
- `GCS_BUCKET_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `INSTANCE_CONNECTION_NAME`

`DB_SOCKET_PATH` is optional.
