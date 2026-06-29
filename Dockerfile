# Dockerfile — OrderGenieSolution
# Build : docker build -t ordergenie-app .
# Run   : docker compose up

FROM node:24-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

FROM node:24-alpine

WORKDIR /app
RUN apk add --no-cache docker-cli curl bash postgresql-client python3

COPY --from=builder /app/node_modules /app/node_modules
COPY . .

EXPOSE 8080

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
