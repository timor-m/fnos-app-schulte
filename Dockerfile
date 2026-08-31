ARG NODE_IMAGE=node:22-bookworm-slim
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP_VERSION=local
ARG GATEWAY_PREFIX=/
ENV APP_VERSION=${APP_VERSION} GATEWAY_PREFIX=${GATEWAY_PREFIX}
RUN npm run build
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app/.server-dist ./.server-dist
COPY --from=build --chown=node:node /app/scripts/start.mjs ./scripts/start.mjs
COPY --from=build --chown=node:node /app/scripts/reset-local-admin-password.mjs ./scripts/reset-local-admin-password.mjs
COPY --from=build --chown=node:node /app/template.config.json /app/package.json ./
RUN mkdir -p /data && chown -R node:node /data /app
ENV NODE_ENV=production AUTH_MODE=local GATEWAY_PREFIX=/ HOST=0.0.0.0 PORT=3333 STORAGE_DIR=/data
USER node
EXPOSE 3333
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3333/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "scripts/start.mjs"]
