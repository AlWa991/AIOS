# Build stage — dev deps for tsc
FROM node:22-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# Production stage — prod deps only
FROM node:22-alpine
ENV NODE_ENV=production COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY migrations ./migrations
COPY fixtures ./fixtures
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/apps/dashboard/server.js"]
