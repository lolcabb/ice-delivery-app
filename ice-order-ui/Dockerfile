# Build React
FROM node:22-alpine AS builder
WORKDIR /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN if [ -z "$VITE_API_BASE_URL" ]; then \
      echo "Error: VITE_API_BASE_URL build arg not set" >&2; \
      exit 1; \
    fi

COPY package*.json ./
RUN npm ci
COPY . .
RUN echo "Build-time Check API URL: $VITE_API_BASE_URL"
RUN npm run build

# Serve with nginx
FROM nginx:stable-alpine
# Copy Vite build output
COPY --from=builder /app/dist /usr/share/nginx/html

RUN mkdir /etc/nginx/templates
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

COPY entrypoint.sh /entrypoint.sh
RUN ls -l /entrypoint.sh || echo "/entrypoint.sh not found after COPY"
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]


