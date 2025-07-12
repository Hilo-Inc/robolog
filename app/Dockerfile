# === Stage 1: Build the Node.js application ===
# Use a small, efficient image just for building the app
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
# Install dependencies
RUN npm install --omit=dev
# Copy the rest of the application source code
COPY . .


# === Stage 2: Create the final production image ===
# Start from the Ubuntu base that has the tools we need for production
FROM ubuntu:22.04

# Suppress interactive APT prompts
ENV DEBIAN_FRONTEND=noninteractive

# ---- System & dependencies ----
# Install only the necessary runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      nginx \
      nodejs \
      npm \
    && npm install -g pm2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---- Nginx ----
COPY nginx.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# ---- Application code ----
WORKDIR /usr/src/app
# ✅ BEST PRACTICE: Copy only the built application and its node_modules
# from the 'builder' stage. This keeps the final image clean.
COPY --from=builder /usr/src/app .

# ---- PM2 ----
ENV PM2_LOG_DATE_FORMAT="YYYY-MM-DD HH:mm:ss"

# ---- Expose & Entrypoint ----
EXPOSE 80
CMD service nginx start && pm2-runtime start ecosystem.config.cjs
