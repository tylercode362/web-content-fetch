FROM node:22.22.1-bookworm-slim@sha256:4f77a690f2f8946ab16fe1e791a3ac0667ae1c3575c3e4d0d4589e9ed5bfaf3d AS base

RUN groupadd --gid 10001 app && useradd --uid 10001 --gid 10001 --create-home app
WORKDIR /app

FROM golang:1.24-bookworm@sha256:98d673f18a1aac43da744209873cb79323e11706f909251bcfb131828b95559d AS kepubify-build
ARG KEPUBIFY_VERSION=v4.0.4
ARG KEPUBIFY_COMMIT=8e959eda11d783041fc03c1a8109275a27f2f2dc
WORKDIR /src
RUN git clone --depth 1 --branch "${KEPUBIFY_VERSION}" https://github.com/pgaskin/kepubify.git . \
    && test "$(git rev-parse HEAD)" = "${KEPUBIFY_COMMIT}" \
    && go build -trimpath -ldflags "-s -w -X main.version=${KEPUBIFY_VERSION}" -o /out/kepubify ./cmd/kepubify

FROM base AS dependencies
COPY --chown=app:app package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM dependencies AS runtime
ENV NODE_ENV=production
RUN npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v1.22.22 \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/pnpm /usr/local/bin/pnpx
COPY --chown=app:app *.js ui.css ./
COPY --from=kepubify-build --chown=app:app /out/kepubify /usr/local/bin/kepubify
RUN mkdir -p /var/lib/web-content-fetch/state /var/lib/web-content-fetch/output \
    && chown -R app:app /var/lib/web-content-fetch
ENV WEB_CONTENT_FETCH_KEPUBIFY_PATH=/usr/local/bin/kepubify
USER app
CMD ["node", "server.js"]

FROM runtime AS test
COPY --chown=app:app test ./test
COPY --chown=app:app scripts ./scripts
COPY --chown=app:app updater ./updater
COPY --chown=app:app compose*.yaml ./
CMD ["sh", "-c", "node --test test/*.test.js"]

FROM base AS tools
WORKDIR /opt/openspec
RUN npm init -y >/dev/null 2>&1 \
    && npm install --ignore-scripts @fission-ai/openspec@1.8.0
USER app
