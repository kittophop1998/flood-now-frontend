# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_ORIGIN
ARG NEXT_PUBLIC_IMAGEKIT_BASE_URL
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN \
    NEXT_PUBLIC_IMAGEKIT_BASE_URL=$NEXT_PUBLIC_IMAGEKIT_BASE_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN addgroup -S floodnow && adduser -S floodnow -G floodnow

COPY --from=build /app/public ./public
COPY --from=build --chown=floodnow:floodnow /app/.next/standalone ./
COPY --from=build --chown=floodnow:floodnow /app/.next/static ./.next/static

USER floodnow
EXPOSE 3000
ENTRYPOINT ["node", "server.js"]
