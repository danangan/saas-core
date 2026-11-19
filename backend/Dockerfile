# The backend: the API (default command) and the job worker (`node dist/worker.js`), plus
# the tools run beside them (migrations, admin:create). Build from the repo root:
#   docker build -f backend/Dockerfile -t saas-core-backend .
FROM docker.io/library/node:24-bookworm-slim

# OpenSSL for Prisma's migration engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
 && corepack enable
# AWS's RDS CA bundle, to verify Aurora's certificate (DB_SSL_ROOT_CERT).
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/rds-global-bundle.pem
WORKDIR /web

# The workspace parts the backend needs: itself, @saas-core/shared (bundled into dist), and
# the Prisma schema and migrations. Installing generates the Prisma client (shared's postinstall).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY prisma ./prisma
COPY shared ./shared
COPY backend ./backend
# Dev dependencies stay: prisma (migrations) and tsx (scripts/create-admin.ts) run from this
# image. So NODE_ENV=production comes after the install, which would otherwise skip them.
RUN pnpm install --frozen-lockfile --filter "@saas-core/backend..." \
 && pnpm --filter @saas-core/backend build
ENV NODE_ENV=production

WORKDIR /web/backend
USER node
EXPOSE 4000
ENV HOST=0.0.0.0 PORT=4000
CMD ["node", "dist/server.js"]
