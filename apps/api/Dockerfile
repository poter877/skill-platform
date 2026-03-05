FROM oven/bun:1 AS base

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests + lockfile for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install deps with frozen lockfile for reproducibility
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/

# Verify no .env was copied
RUN test ! -f .env || (echo "ERROR: .env copied into image" && exit 1)

EXPOSE 3001
CMD ["bun", "run", "apps/api/src/index.ts"]
