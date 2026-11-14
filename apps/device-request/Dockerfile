# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0

# Stage 1: build SPA (Vite, base /thiet-bi/)
FROM node:22.22.0-alpine AS builder

WORKDIR /app

ARG VITE_KEYCLOAK_URL=http://localhost:8080
ARG VITE_KEYCLOAK_REALM=dxdesk
ARG VITE_KEYCLOAK_CLIENT_ID=dxdesk-device

ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: phục vụ bằng Nginx phía sau APISIX
FROM nginx:1.28.0-alpine AS runner

RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html/thiet-bi

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
