FROM ubuntu:22.04

# Suppress interactive APT prompts
ENV DEBIAN_FRONTEND=noninteractive

# ---- System & dependencies ----
RUN apt-get update && \
    apt-get install -y \
      curl gnupg ca-certificates lsb-release software-properties-common \
      nginx \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pm2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---- Nginx ----
COPY nginx.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# ---- Application code ----
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# ---- PM2 ----
ENV PM2_LOG_DATE_FORMAT="YYYY-MM-DD HH:mm:ss"

# ---- Expose & Entrypoint ----
EXPOSE 80
CMD service nginx start && pm2-runtime start ecosystem.config.js
