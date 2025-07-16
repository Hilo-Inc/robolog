#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# Start nginx in the background
echo "Starting nginx..."
service nginx start

# Start PM2 in the foreground. `exec` makes PM2 the main process,
# which correctly handles signals from Docker to ensure a graceful shutdown.
echo "Starting PM2..."
pm2 start ecosystem.config.cjs && pm2 logs
