# BFF v3 (M280 §1) — image de déploiement. Multi-stage : build shared+server, run dist/index.js. NODE_ENV=production.
# DATABASE_URL (DSN DB2), SIDECAR_URL, CORS_ORIGINS, PORT fournis au runtime (secrets hors image, R2).
FROM node:22-slim AS build
WORKDIR /app
# Manifests d'abord (couche cache) : monorepo workspaces shared + server.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm ci
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY server/ server/
RUN npm run build --workspace shared && npm run build --workspace server

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=8080
# node_modules porte le lien de workspace @barjotur/shared → shared/ (préservé par la copie).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/sante',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
