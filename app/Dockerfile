# === Stage 1: Build the Next.js application ===
# This stage installs dependencies and builds the Next.js production output.
# ✅ BEST PRACTICE: Use a glibc-based build image (like -slim) to match the glibc-based Ubuntu runtime.
FROM node:20-slim AS builder
WORKDIR /usr/src/app

COPY package*.json ./

# ✅ BEST PRACTICE: Use `npm ci` for faster, more reliable, and reproducible builds.
# This uses the package-lock.json to install exact dependency versions.
RUN npm ci

# Copy the rest of the application source code and build the app
COPY . .
RUN npm run build


# === Stage 2: Create the final production image ===
# Start from the Ubuntu base that has the tools we need for production
FROM ubuntu:22.04

# Suppress interactive APT prompts
ENV DEBIAN_FRONTEND=noninteractive

# ---- System & dependencies ----
# Install only the necessary runtime dependencies
# ✅ BEST PRACTICE: Install a specific Node.js version to match the build environment,
# avoiding potential mismatches from the default OS repositories.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      nginx \
      ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---- Nginx ----
COPY nginx.conf /etc/nginx/sites-available/default
# ✅ Add this line to copy your new certificates into the image
COPY certs/ /etc/nginx/certs/
# You can remove this line if you're not using a `sites-enabled` directory structure
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# ---- Application code ----
WORKDIR /usr/src/app
# ✅ BEST PRACTICE: Copy only the necessary production artifacts from the builder stage.
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/node_modules ./node_modules

# ---- Entrypoint ----
 # Copy the entrypoint script into the container.
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

# ✅ FIX: Ensure the script has Unix-style line endings (LF) and is executable.
# This prevents the 'no such file or directory' error when building on Windows.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

# ---- Expose & Entrypoint ----
EXPOSE 80 443
# ✅ BEST PRACTICE: Use the full path for the entrypoint for clarity and robustness.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
