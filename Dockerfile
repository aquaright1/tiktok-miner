FROM oven/bun:1.0.25 AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y gnupg2 && \
    apt-get install -y debian-archive-keyring && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get update && \
    apt-get install -y \
    python3 \
    build-essential \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Copy entire project
COPY . .

# Build arguments for environment variables
ARG DATABASE_URL
ARG DIRECT_URL
ARG NODE_ENV=production
ARG PORT=8080

# Set environment variables from build args
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL
ENV NODE_ENV=$NODE_ENV
ENV PORT=$PORT

# Enter app directory and install dependencies
WORKDIR /app/app
RUN ls -la
RUN bun install --verbose
RUN ls -la node_modules
RUN bun --version
RUN node --version

# Build CLI tool
RUN bun build cli/index.ts --outdir dist --target node

# Build Next.js application
RUN bunx prisma generate
# Skip migrations during build - they'll run at startup
# RUN bunx prisma migrate deploy
RUN bun run build

# Expose port
EXPOSE 8080

# Create startup script
RUN echo '#!/bin/bash\n\
echo "Running database migrations..."\n\
bunx prisma migrate deploy\n\
echo "Starting application..."\n\
bun run start' > /app/app/start.sh && \
    chmod +x /app/app/start.sh

# Start command
CMD ["/bin/bash", "/app/app/start.sh"]