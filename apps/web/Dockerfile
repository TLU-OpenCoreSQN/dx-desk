# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0

# -----------------------------------------------------------------------------
# Stage 1: Build the React SPA
# -----------------------------------------------------------------------------
FROM node:22.22.0-alpine AS builder

WORKDIR /app

# Build arguments for Vite OIDC and API configurations
ARG VITE_KEYCLOAK_URL=http://localhost:8080
ARG VITE_KEYCLOAK_REALM=dxdesk
ARG VITE_KEYCLOAK_CLIENT_ID=dxdesk-web
ARG VITE_API_BASE_URL=/api

ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy package descriptors first for Docker layer caching
COPY package*.json ./

# Install exact dependencies
RUN npm ci

# Copy application sources
COPY . .

# Build production assets
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve via Nginx
# -----------------------------------------------------------------------------
FROM nginx:1.28.0-alpine AS runner

# Remove default configuration and assets
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration with /healthz and SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled SPA bundle from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
