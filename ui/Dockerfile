# The UI: Next.js's standalone server. Build from the repo root:
#   docker build -f ui/Dockerfile -t saas-core-ui .
FROM docker.io/library/node:24-bookworm-slim AS build

RUN corepack enable
WORKDIR /web
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY prisma ./prisma
COPY shared ./shared
COPY ui ./ui
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile --filter "@saas-core/ui..." \
 && pnpm --filter @saas-core/ui build

FROM docker.io/library/node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
# The standalone server and the workspace files it traced; static assets and public/
# aren't part of it, so they're copied next to it.
COPY --from=build --chown=node /web/ui/.next/standalone ./
COPY --from=build --chown=node /web/ui/.next/static ./ui/.next/static
COPY --from=build --chown=node /web/ui/public ./ui/public
USER node
EXPOSE 3000
CMD ["node", "ui/server.js"]
