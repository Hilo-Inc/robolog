# 📡 Webhook Platform Configuration Guide

This guide provides specific configuration examples for each supported webhook platform in Robolog.

## 🔧 Quick Setup

Set these environment variables in your `.env` file:

```bash
# Required: Your webhook URL
WEBHOOK_URL=https://your-webhook-url-here

# Required: Platform type (affects payload format)
WEBHOOK_PLATFORM=discord  # Options: discord, slack, teams, telegram, mattermost, rocketchat, generic
```

## 🎯 Platform-Specific Configuration

### 1. Discord (Default)
```bash
WEBHOOK_PLATFORM=discord
WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

**Setup Instructions:**
1. Go to your Discord server
2. Right-click on the channel → Edit Channel
3. Go to Integrations → Webhooks
4. Create New Webhook
5. Copy the Webhook URL

### 2. Slack
```bash
WEBHOOK_PLATFORM=slack
WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

**Setup Instructions:**
1. Go to your Slack workspace
2. Apps → Manage → Custom Integrations
3. Incoming Webhooks → Add Configuration
4. Choose channel and copy Webhook URL

### 3. Microsoft Teams
```bash
WEBHOOK_PLATFORM=teams
WEBHOOK_URL=https://outlook.office.com/webhook/YOUR_TEAMS_WEBHOOK_URL
```

**Setup Instructions:**
1. Go to your Teams channel
2. Click "..." → Connectors
3. Find "Incoming Webhook" → Configure
4. Name it "Robolog" and copy the URL

### 4. Telegram
```bash
WEBHOOK_PLATFORM=telegram
WEBHOOK_URL=https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>
```

**Setup Instructions:**
1. Message @BotFather on Telegram
2. Create new bot: `/newbot`
3. Get your bot token
4. Get your chat ID (message your bot, then visit: `https://api.telegram.org/bot<TOKEN>/getUpdates`)
5. Combine: `https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>`

### 5. Mattermost
```bash
WEBHOOK_PLATFORM=mattermost
WEBHOOK_URL=https://your-mattermost.com/hooks/YOUR_WEBHOOK_ID
```

**Setup Instructions:**
1. Go to your Mattermost instance
2. System Console → Integrations
3. Enable incoming webhooks
4. Create webhook in your channel
5. Copy the webhook URL

### 6. Rocket.Chat
```bash
WEBHOOK_PLATFORM=rocketchat
WEBHOOK_URL=https://your-rocketchat.com/hooks/YOUR_WEBHOOK_ID
```

**Setup Instructions:**
1. Go to your Rocket.Chat instance
2. Administration → Integrations → Incoming
3. Create New Integration
4. Set channel and copy webhook URL

### 7. Generic/Custom Webhook
```bash
WEBHOOK_PLATFORM=generic
WEBHOOK_URL=https://your-custom-endpoint.com/webhook
```

**Payload Format:**
```json
{
  "message": "🤖 AI Log Analysis (English):\nYour log analysis...",
  "platform": "robolog",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "language": "English",
  "source": "ai-log-analysis"
}
```

## 🚀 Installation with Platform Selection

You can specify the webhook platform during installation:

```bash
# Discord (default)
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install-native.sh | sudo bash -s -- --platform discord

# Slack
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install-native.sh | sudo bash -s -- --platform slack

# Teams
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install-native.sh | sudo bash -s -- --platform teams

# Telegram
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install-native.sh | sudo bash -s -- --platform telegram

# Complete example with all options
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install-native.sh | sudo bash -s -- --yes --model gemma3n:e2b --language English --platform slack
```

## 🔄 Switching Platforms

To switch between platforms, edit your configuration:

```bash
# Edit configuration
robolog config

# Or directly edit the .env file
nano /opt/robolog/.env
```

Then restart the service:
```bash
robolog restart
```

## 🧪 Testing Your Webhook

After configuration, test your webhook:

```bash
# Generate test errors
robolog test-errors

# Check service status
robolog status

# View logs
robolog logs
```

You should receive notifications on your chosen platform within 60 seconds!

## 🌐 Multilingual Support

All platforms support multilingual notifications. Set your preferred language:

```bash
LANGUAGE=Spanish  # Will send notifications in Spanish
LANGUAGE=French   # Will send notifications in French
LANGUAGE=German   # Will send notifications in German
# ... and many more languages supported
```

## 🔧 Troubleshooting

### Common Issues:

1. **No notifications received**
   - Check webhook URL is correct
   - Verify platform is set correctly
   - Check service status: `robolog status`

2. **Webhook errors in logs**
   - Verify webhook URL is accessible
   - Check platform-specific authentication
   - Review logs: `robolog logs`

3. **Wrong message format**
   - Ensure `WEBHOOK_PLATFORM` matches your platform
   - Some platforms require specific URL formats (especially Telegram)

### Debug Mode:
```bash
# Check environment variables
cat /opt/robolog/.env

# View detailed logs
journalctl -u robolog-analyzer -f

# Test webhook manually
curl -X POST "YOUR_WEBHOOK_URL" -H "Content-Type: application/json" -d '{"content":"Test message"}'
```

## 📚 Advanced Configuration

### Custom Headers
For platforms requiring authentication headers, you can modify the webhook function in `analyzer.js`:

```javascript
// Add custom headers in the sendWebhook function
const headers = { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'  // Add custom auth
};
```

### Rate Limiting
Adjust polling frequency to avoid rate limits:

```bash
# In .env file
POLL_MS=30000  # Poll every 30 seconds instead of 10
```

### Message Formatting
Each platform has different message limits and formatting:

- **Discord**: 2000 characters, supports markdown
- **Slack**: 4000 characters, supports mrkdwn
- **Teams**: Rich cards with sections
- **Telegram**: 4096 characters, supports markdown
- **Mattermost**: 4000 characters, supports markdown
- **Rocket.Chat**: 1000 characters, supports markdown
- **Generic**: No specific limits, JSON format 