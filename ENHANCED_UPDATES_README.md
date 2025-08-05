# Enhanced Robolog Update System

This enhanced update system provides granular control over updating different components of your Robolog installation. Instead of updating everything at once, you can now update individual components as needed.

## 🚀 Installation

### For New Installations
The enhanced update system will be included in future versions of the install-native.sh script.

### For Existing Installations
Use the setup script to add enhanced update functionality to your existing Robolog installation:

```bash
# Download the enhanced update files
wget https://raw.githubusercontent.com/Hilo-Inc/robolog/main/update-dashboard.sh
wget https://raw.githubusercontent.com/Hilo-Inc/robolog/main/update-analyzer.sh
wget https://raw.githubusercontent.com/Hilo-Inc/robolog/main/update-all.sh
wget https://raw.githubusercontent.com/Hilo-Inc/robolog/main/setup-enhanced-updates.sh

# Make executable
chmod +x *.sh

# Install enhanced update system
sudo bash setup-enhanced-updates.sh
```

## 📋 Available Update Commands

### 🔄 Component-Specific Updates

| Command | Description | What It Updates | What It Preserves |
|---------|-------------|-----------------|-------------------|
| `sudo robolog update analyzer` | Updates only the analyzer service | • analyzer.js<br>• package.json<br>• Node dependencies | • Dashboard<br>• Nginx config<br>• SSL certificates<br>• System packages |
| `sudo robolog update dashboard` | Updates only the dashboard | • Dashboard app files<br>• Next.js build<br>• Frontend dependencies | • Analyzer<br>• Nginx config<br>• SSL certificates<br>• System packages |
| `sudo robolog update all` | Full system update | • All components<br>• System packages<br>• Ollama<br>• Fluent Bit | • Configuration files<br>• SSL certificates<br>• User data |

### ⚡ Backward Compatibility

| Command | Behavior |
|---------|----------|
| `sudo robolog update` | Updates analyzer only (original behavior) |

## 🛠️ Usage Examples

### Update Only the Analyzer
```bash
# Quick analyzer update
sudo robolog update analyzer

# Analyzer update with options
sudo robolog update analyzer --force --skip-backup
```

### Update Only the Dashboard
```bash
# Quick dashboard update
sudo robolog update dashboard

# Dashboard update with options
sudo robolog update dashboard --force --skip-backup
```

### Full System Update
```bash
# Complete system update
sudo robolog update all

# Full update with options
sudo robolog update all --force --skip-system
```

## ⚙️ Command Options

### Common Options (Available for All Update Commands)

| Option | Description |
|--------|-------------|
| `--force, -f` | Skip confirmation prompts |
| `--skip-backup` | Don't create backup before update |
| `--help, -h` | Show help for specific command |

### Additional Options for `update all`

| Option | Description |
|--------|-------------|
| `--skip-system` | Skip system package updates |
| `--analyzer-only` | Update only analyzer component |
| `--dashboard-only` | Update only dashboard component |

## 🔍 Status and Monitoring

### Check System Status
```bash
# Overall system status
robolog status

# Individual service logs
robolog logs analyzer
robolog logs dashboard
robolog logs fluent-bit
robolog logs ollama
robolog logs nginx

# All logs together
robolog logs
```

### Monitor Updates
```bash
# Watch analyzer logs during update
sudo robolog update analyzer &
robolog logs analyzer

# Check update results
robolog status
```

## 🛡️ Safety Features

### Automatic Backups
- **Analyzer Updates**: Backs up `analyzer.js`, `package.json`, and `node_modules`
- **Dashboard Updates**: Backs up entire app directory
- **Full Updates**: Creates comprehensive backup of all components

### Service Management
- Services are properly stopped before updates
- Services are restarted after successful updates
- Status verification ensures services start correctly

### Rollback Support
```bash
# Find backups
ls -la /opt/robolog/*backup*

# Restore analyzer from backup
sudo systemctl stop robolog-analyzer
sudo cp /opt/robolog/analyzer-backup-TIMESTAMP/analyzer.js /opt/robolog/
sudo cp /opt/robolog/analyzer-backup-TIMESTAMP/package.json /opt/robolog/
sudo systemctl start robolog-analyzer

# Restore dashboard from backup
sudo systemctl stop robolog-dashboard
sudo rm -rf /opt/robolog/app
sudo mv /opt/robolog/app-backup-TIMESTAMP /opt/robolog/app
sudo systemctl start robolog-dashboard
```

## 📁 File Structure

```
/usr/local/share/robolog/          # Shared update scripts
├── update-analyzer.sh             # Analyzer update script
├── update-dashboard.sh            # Dashboard update script
└── update-all.sh                  # Full system update script

/usr/local/bin/robolog             # Enhanced robolog command

/opt/robolog/                      # Main installation
├── analyzer.js                    # Analyzer service
├── package.json                   # Node.js dependencies
├── app/                          # Dashboard (if installed)
├── .env                          # Configuration
├── *-backup-*/                   # Automatic backups
└── logs/                         # Log files
```

## 🔧 Troubleshooting

### Update Script Not Found
```bash
# Check if scripts are installed
ls -la /usr/local/share/robolog/

# Reinstall if missing
sudo bash setup-enhanced-updates.sh
```

### Service Won't Start After Update
```bash
# Check service status
robolog status

# View detailed logs
journalctl -u robolog-analyzer -n 50
journalctl -u robolog-dashboard -n 50

# Restore from backup if needed
ls -la /opt/robolog/*backup*
```

### Permission Issues
```bash
# Fix permissions
sudo chown -R robolog:robolog /opt/robolog/
sudo chmod +x /usr/local/share/robolog/*.sh
```

### Update Fails
```bash
# Check network connectivity
curl -I https://github.com/Hilo-Inc/robolog

# Check disk space
df -h /opt/robolog

# Use force mode to skip prompts
sudo robolog update analyzer --force
```

## 🔄 Update Workflow Best Practices

### 1. Pre-Update Checklist
- [ ] Check current system status: `robolog status`
- [ ] Verify webhook is working: `robolog test-errors`
- [ ] Note current versions/commits
- [ ] Ensure adequate disk space

### 2. Update Strategy
- **Development**: Use `--force` and `--skip-backup` for faster updates
- **Production**: Always use default safety features (backups enabled)
- **Critical Systems**: Test updates on staging environment first

### 3. Post-Update Verification
- [ ] Check service status: `robolog status`
- [ ] Test webhook: `robolog test-errors`
- [ ] Verify dashboard accessibility (if installed)
- [ ] Monitor logs for any issues

## 🚀 Advanced Usage

### Scheduled Updates
```bash
# Add to crontab for weekly analyzer updates
0 2 * * 0 /usr/bin/sudo /usr/local/bin/robolog update analyzer --force --skip-backup

# Monthly full system updates
0 3 1 * * /usr/bin/sudo /usr/local/bin/robolog update all --force
```

### Custom Update Scripts
```bash
# Create custom update workflow
#!/bin/bash
echo "Starting maintenance window..."
sudo robolog stop
sudo robolog update all --force
robolog status
robolog test-errors
echo "Maintenance complete!"
```

### Environment-Specific Updates
```bash
# Development environment
export GITHUB_TOKEN=your_token
sudo -E robolog update all --force --skip-backup

# Production environment
sudo robolog update analyzer  # Conservative approach
# Test thoroughly before dashboard update
sudo robolog update dashboard
```

## 📊 Monitoring and Alerts

### Health Checks
```bash
# Create health check script
#!/bin/bash
if ! robolog status | grep -q "Active: active"; then
    echo "ALERT: Robolog services not running!"
    # Send notification to your monitoring system
fi
```

### Update Notifications
```bash
# Log update events
echo "$(date): Updated analyzer" >> /var/log/robolog-updates.log

# Webhook notification after updates
curl -X POST "$WEBHOOK_URL" -d '{"content":"Robolog updated successfully"}'
```

This enhanced update system provides production-ready component management while maintaining the simplicity and safety that Robolog users expect.