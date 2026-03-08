FROM node:22-slim
WORKDIR /app

# Install pnpm
RUN corepack enable

# Copy root package files first for layer caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy portal package files
COPY portal/package.json portal/pnpm-lock.yaml* portal/
RUN cd portal && pnpm install --frozen-lockfile

# Copy everything
COPY . .

# Create persistent data dir
RUN mkdir -p /app/portal/data

WORKDIR /app/portal
ENV NODE_ENV=production
ENV PORT=3547
EXPOSE 3547

CMD ["node", "--experimental-strip-types", "server.ts"]
