FROM oven/bun:1.3.14-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN bun run build

FROM oven/bun:1.3.14-alpine
ARG BUILD_ARCH=amd64
ARG BUILD_VERSION=dev
LABEL io.hass.type="addon" io.hass.name="HA Editor" io.hass.arch="${BUILD_ARCH}" io.hass.version="${BUILD_VERSION}" \
      org.opencontainers.image.source="https://github.com/j4n-e4t/ha-editor" \
      org.opencontainers.image.description="A minimal file tree and Monaco editor add-on for Home Assistant"
WORKDIR /app
ENV NODE_ENV=production CONFIG_ROOT=/config PORT=8099 INGRESS_ONLY=true
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production && rm -rf ~/.bun/install/cache
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 8099
CMD ["bun", "server/index.js"]
