# Dashboard Update Script

This script (`update-dashboard.sh`) provides a safe and automated way to update only the Robolog dashboard files without affecting nginx configuration or other system settings.

## Prerequisites

- Robolog must already be installed with the dashboard (using `--with-dashboard` flag)
- Must be run as root (use `sudo`)
- Internet connection to download latest files from GitHub

## Usage

### Basic Update
```bash
sudo bash update-dashboard.sh
```

### Force Update (no confirmation)
```bash
sudo bash update-dashboard.sh --force
```

### Skip Backup Creation
```bash
sudo bash update-dashboard.sh --skip-backup
```

### With GitHub Token (for private repositories)
```bash
export GITHUB_TOKEN=your_github_token_here
sudo -E bash update-dashboard.sh
```

## What This Script Does

1. **Safety Checks**: Verifies that Robolog and dashboard are properly installed
2. **Backup**: Creates a timestamped backup of the current dashboard
3. **Download**: Fetches the latest dashboard code from GitHub
4. **Service Management**: Safely stops the dashboard service during update
5. **File Update**: Replaces dashboard files with latest version
6. **Build Process**: Installs dependencies and builds the dashboard
7. **Cleanup**: Removes development dependencies and temporary files
8. **Restart**: Starts the dashboard service back up

## What This Script Does NOT Do

- ❌ Does not modify nginx configuration
- ❌ Does not change SSL certificates
- ❌ Does not update the analyzer service
- ❌ Does not modify system services or dependencies
- ❌ Does not change Fluent Bit or Ollama configurations

## Safety Features

- **Automatic Backup**: Creates backup before making changes
- **Service Management**: Properly stops/starts services
- **Rollback Information**: Shows how to restore from backup if needed
- **Status Verification**: Checks that services start successfully
- **Cleanup**: Removes temporary files after update

## Recovery

If something goes wrong, you can restore from the automatic backup:

```bash
# Find your backup directory
ls -la /opt/robolog/app-backup-*

# Restore from backup (replace with your backup timestamp)
sudo systemctl stop robolog-dashboard
sudo rm -rf /opt/robolog/app
sudo mv /opt/robolog/app-backup-YYYYMMDD-HHMMSS /opt/robolog/app
sudo systemctl start robolog-dashboard
```

## Logs and Troubleshooting

Check dashboard status:
```bash
robolog status
robolog logs dashboard
```

Manual service management:
```bash
sudo systemctl status robolog-dashboard
sudo systemctl restart robolog-dashboard
sudo journalctl -u robolog-dashboard -f
```

## Command Line Options

| Option | Description |
|--------|-------------|
| `--force, -f` | Skip confirmation prompt |
| `--skip-backup` | Don't create backup (not recommended) |
| `--help, -h` | Show help message |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token (for private repos) |

## Example Output

```
🔄 Robolog Dashboard Update
=============================
📦 Creating backup of current dashboard...
✅ Backup created at: /opt/robolog/app-backup-20241215-143022
📥 Downloading latest Robolog source from GitHub...
✅ Latest source downloaded and extracted
⏹️ Stopping dashboard service...
✅ Dashboard service stopped
🔄 Updating dashboard files...
📁 Copying new dashboard files...
📦 Installing dashboard dependencies...
🔨 Building the dashboard...
🧹 Cleaning up development packages...
✅ Dashboard files updated successfully
▶️ Starting dashboard service...
✅ Dashboard service started successfully
🧹 Cleaning up temporary files...
✅ Temporary files cleaned up

🎉 Dashboard update completed successfully!

📊 Update Status:
✅ Dashboard files updated
✅ Dependencies installed
✅ Dashboard built
✅ Dashboard service running
✅ Nginx is running - dashboard should be accessible
🌐 Dashboard URL: https://192.168.1.100
```

## Integration with Main Robolog Command

This script can be integrated with the main `robolog` command by adding an update option that specifically targets the dashboard:

```bash
robolog update dashboard
```

This would provide a consistent interface with the existing robolog management commands.