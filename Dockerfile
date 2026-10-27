# Build stage: install dependencies and build the static app.
FROM node:22-alpine AS build

WORKDIR /app

# Layer cache: copy the manifests first, install, then the rest of the source.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# Runtime stage: non-root nginx serving the static build on port 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# The unprivileged image already runs as the non-root "nginx" user; keep it.
COPY dist/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

LABEL org.opencontainers.image.source="https://github.com/jamesgallagher/NuvioManager"
LABEL org.opencontainers.image.title="Nuvio Manager"
LABEL org.opencontainers.image.description="Remote management web app for Nuvio TV: catalog order, visibility, titles and addons across managed accounts. All state lives in the browser; no data is stored on the server."
