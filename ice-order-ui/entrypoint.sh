#!/bin/sh
# entrypoint.sh

# Substitute environment variables in the nginx config template
# Input: /etc/nginx/templates/default.conf.template
# Output: /etc/nginx/conf.d/default.conf
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx with the generated config
nginx -g 'daemon off;'