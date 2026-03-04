FROM oven/bun:1

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install dependencies using bun (bun handles pnpm workspaces)
RUN bun install

# Copy source code
COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/

EXPOSE 3001
CMD ["bun", "run", "apps/api/src/index.ts"]
