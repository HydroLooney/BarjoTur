# Client v3 (M280 §1) — build Vite (SPA) servi en statique par nginx. Le front appelle /api (BFF) et /tiles (Martin) via
# le proxy amont (NPM/Authentik) ; cette image ne sert QUE les fichiers statiques + le fallback SPA.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY client/package.json client/
RUN npm ci
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY client/ client/
RUN npm run build --workspace shared && npm run build --workspace client

FROM nginx:alpine AS run
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY deploy/nginx-client.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
