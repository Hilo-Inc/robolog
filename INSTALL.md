# 🚀 Robolog Installation Guide

## Quick Installation (Linux)

### One-Line Installation (Recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install.sh | sudo bash
```

### Manual Installation
```bash
# Clone the repository
git clone https://github.com/Hilo-Inc/robolog.git
cd robolog

# Run installation script
chmod +x install.sh
sudo ./install.sh

# Configure Discord webhook
robolog config

# Start the service
robolog start
```

## Quick Testing (No System Installation)

For immediate testing without system installation:

```bash
# Clone and start
git clone https://github.com/Hilo-Inc/robolog.git
cd robolog
chmod +x quick-start.sh
./quick-start.sh

# Configure Discord webhook (optional)
nano .env

# Test the system
curl http://localhost/generate-realistic-errors
```

## Development Setup

```bash
# Clone repository
git clone https://github.com/Hilo-Inc/robolog.git
cd robolog

# Setup development environment
make dev-setup

# Start services
make start

# Generate test errors
make test-errors
```

## Requirements

- **Linux Distribution**: Ubuntu 20.04+, Debian 11+, CentOS 7+, RHEL 7+, Fedora 35+, or Arch Linux
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Memory**: Minimum 4GB RAM (8GB recommended for AI model)
- **Disk Space**: 10GB free space (for Docker images and AI model)

## Post-Installation

After installation, use these commands:

```bash
# Service Management
robolog start          # Start all services
robolog stop           # Stop all services
robolog restart        # Restart all services
robolog status         # Show service status

# Configuration & Testing
robolog config         # Edit configuration file
robolog test-errors    # Generate realistic test errors
robolog logs           # View logs from all services

# Maintenance
robolog update         # Update to latest version
robolog uninstall      # Completely remove Robolog
```

## Configuration

1. **Get Discord Webhook URL**:
   - Go to your Discord server settings
   - Navigate to Integrations > Webhooks
   - Create a new webhook
   - Copy the webhook URL

2. **Configure Robolog**:
   ```bash
   robolog config
   ```
   
3. **Add your webhook URL to the configuration file**:
   ```bash
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
   ```

4. **Start the service**:
   ```bash
   robolog start
   ```

5. **Test the system**:
   ```bash
   robolog test-errors
   ```

## Verification

Check your Discord channel within 60 seconds for AI-powered log analysis!

## Troubleshooting

### Service Won't Start
```bash
# Check Docker status
sudo systemctl status docker
sudo systemctl start docker

# Check Robolog status
robolog status
```

### Model Download Issues
```bash
# Pull model manually
docker-compose exec ollama ollama pull gemma3n:e2b
```

### Discord Not Receiving Messages
```bash
# Verify webhook URL
robolog config

# Check logs
robolog logs analyzer
```

### Reset Everything
```bash
# Complete reset
robolog stop
robolog uninstall
# Then reinstall
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install.sh | sudo bash
```

## Support

- **GitHub Issues**: https://github.com/Hilo-Inc/robolog/issues
- **Documentation**: https://github.com/Hilo-Inc/robolog
- **Discord Community**: [Link to your Discord server]

## What's Installed

The installation creates:
- **System service**: `/etc/systemd/system/robolog.service`
- **Application files**: `/opt/robolog/`
- **Management command**: `/usr/local/bin/robolog`
- **User account**: `robolog` (for security)
- **Configuration**: `/opt/robolog/.env`

Everything can be cleanly removed with `robolog uninstall`. 