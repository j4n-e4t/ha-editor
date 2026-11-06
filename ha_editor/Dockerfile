FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN bun run build

FROM oven/bun:1.3-alpine
LABEL io.hass.type="addon" io.hass.name="HA Editor" org.opencontainers.image.source="https://github.com/j4n-e4t/ha-editor"
WORKDIR /app
ENV NODE_ENV=production CONFIG_ROOT=/config PORT=8099 INGRESS_ONLY=true
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production && rm -rf ~/.bun/install/cache
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 8099
CMD ["bun", "server/index.js"]
