#!/bin/bash

echo "🚀 Systemd is ready. Running installer script..."
/tmp/install-native.sh --yes --skip-model
echo "✅ Installer script finished."

echo "--- Final Robolog Status ---"
robolog status

echo "--- Test Complete. Shutting down container... ---"
/sbin/poweroff -f