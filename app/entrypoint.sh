#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# Start nginx in the background
echo "Starting nginx..."
service nginx start

echo "Starting Next.js application..."
# ✅ BEST PRACTICE: Use `exec` to make the Node.js process the main container process.
# This ensures that signals are handled correctly and logs are sent to stdout/stderr,
# allowing Fluent Bit to collect them without needing a process manager like PM2.
exec npm start
