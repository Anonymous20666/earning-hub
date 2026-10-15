FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
COPY shared ./shared
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3107 COOKIE_SECURE=true DATABASE_PATH=/app/data/pappy.sqlite
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server.ts ./
COPY backend ./backend
COPY shared ./shared
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3107
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3107/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","node_modules/tsx/dist/cli.mjs","server.ts"]
