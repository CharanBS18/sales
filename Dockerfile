# Optional: only used if you pick "Docker" runtime on Render.
# The default render.yaml uses the Node runtime and does NOT need this file.
FROM oven/bun:1.1 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
ENV NITRO_PRESET=node-server
RUN bun run build

FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000
CMD ["node", ".output/server/index.mjs"]
