# 🚀 Robolog - AI-Powered Log Monitoring

> **Intelligent log monitoring with AI-powered analysis and Discord notifications**

Robolog automatically monitors your system logs, detects critical issues, and sends intelligent summaries to Discord using AI analysis powered by Ollama and Gemma 3n (default).

## 📦 Quick Installation (Linux)

### 🚀 Native Installation (Recommended - No Docker Required)
```bash
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install-native.sh | sudo bash
```

**Installation Options:**
```bash
# Standard installation (prompts for AI model and language selection)
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install-native.sh | sudo bash

# Skip AI model download (faster, download later)  
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install-native.sh | sudo bash -s -- --skip-model

# Auto-download specific model with language preference
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install-native.sh | sudo bash -s -- --yes --model gemma3n:e2b --language English --platform slack

# Available options:
# --model gemma3n:e2b  (5.6GB) - Google Gemma 3n [default]
# --model qwen3:8b     (5.2GB) - Alibaba Qwen 3 with thinking mode
# --model llama3.2:1b  (1.3GB) - Meta LLaMA (fastest)
# --model phi3:mini    (2.3GB) - Microsoft Phi-3 (balanced)
# --language English   - Default language for AI responses
# --language Spanish   - Responses in Spanish (Español)
# --language French    - Responses in French (Français)
# --language German    - Responses in German (Deutsch)
# --language Chinese   - Responses in Chinese (中文)
# --language Japanese  - Responses in Japanese (日本語)
# --language Portuguese - Responses in Portuguese (Português)
# --language Russian   - Responses in Russian (Русский)
# --language Italian   - Responses in Italian (Italiano)
# --platform discord   - Discord webhooks [default]
# --platform slack     - Slack incoming webhooks
# --platform teams     - Microsoft Teams connectors
# --platform telegram  - Telegram bot API
# --platform mattermost - Mattermost incoming webhooks
# --platform rocketchat - Rocket.Chat integrations
# --platform generic   - Generic JSON webhook endpoint
# ... and many more languages supported
```

**Benefits:**
- ✅ No Docker dependency (lighter footprint)
- ✅ Better performance (no container overhead) 
- ✅ Direct system integration with systemd
- ✅ Lower resource usage (~500MB vs ~2GB with Docker)
- ✅ Multiple AI model options (Gemma 3n [default], Qwen 3, LLaMA 3.2, Phi-3)
- ✅ Multilingual support (English, Spanish, French, German, Chinese, Japanese, and more)
- ✅ Optional AI model download (5.6GB Gemma 3n or smaller alternatives)

### 🐳 Docker Installation
```bash
curl -fsSL https://raw.githubusercontent.com/Hilo-Inc/robolog/main/install.sh | sudo bash
```

**Benefits:**
- ✅ Consistent environment across systems
- ✅ Easy to containerize and scale
- ✅ Isolated from host system
- ✅ Manual configuration for model and language preferences

### Manual Installation
```bash
# Clone the repository
git clone https://github.com/Hilo-Inc/robolog.git
cd robolog

# Choose your installation method:
# Native (recommended):
chmod +x install-native.sh
sudo ./install-native.sh

# OR Docker:
chmod +x install.sh
sudo ./install.sh

# Configure your Discord webhook
robolog config

# Start the service
robolog start
```

### Using Make (Development)
```bash
# Clone and setup
git clone https://github.com/Hilo-Inc/robolog.git
cd robolog

# Setup development environment
make dev-setup

# Start services
make start

# Test the system
make test-errors
```

## 🆚 Installation Comparison

| Feature | Native Installation | Docker Installation |
|---------|-------------------|-------------------|
| **Dependencies** | Node.js, Fluent Bit, Ollama | Docker, Docker Compose |
| **Resource Usage** | ~500MB RAM | ~2GB RAM |
| **Performance** | Direct execution | Container overhead |
| **System Integration** | Full systemd integration | Limited integration |
| **Isolation** | Shared with host | Containerized |
| **Updates** | Component-based | Image-based |
| **AI Model Options** | Interactive selection | Manual configuration |
| **Language Support** | Interactive selection | Manual configuration |
| **Installation Time** | 2-15 min (depends on model) | 5-20 min |
| **Best For** | Production servers, VPS | Development, K8s |

## 🛠️ Management Commands

After installation, use these commands to manage Robolog:

```bash
# Service control
robolog start          # Start all services
robolog stop           # Stop all services
robolog restart        # Restart all services
robolog status         # Show service status

# Monitoring and testing
robolog logs           # View logs from all services
robolog test-errors    # Generate realistic test errors
robolog health         # Check system health

# Configuration
robolog config         # Edit configuration file
robolog update         # Update to latest version
robolog uninstall      # Completely remove Robolog

# 📝 Configuration includes:
# - Webhook URL and platform selection (Discord, Slack, Teams, Telegram, Mattermost, Rocket.Chat, Generic)
# - AI model selection (gemma3n:e2b [default], qwen3:8b, llama3.2:1b, phi3:mini)
# - Language preference (English, Spanish, French, German, Chinese, Japanese, etc.)
# - Polling interval and other settings
```

## 🔧 Configuration

Edit the configuration file:
```bash
robolog config
```

Add your webhook URL and configure platform:
```bash
# Webhook Platform Configuration
WEBHOOK_PLATFORM=discord  # Options: discord, slack, teams, telegram, mattermost, rocketchat, generic
WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN

# Platform-specific examples:
# Discord: https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
# Slack: https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
# Teams: https://outlook.office.com/webhook/YOUR_TEAMS_WEBHOOK_URL
# Telegram: https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>
# Mattermost: https://your-mattermost.com/hooks/YOUR_WEBHOOK_ID
# Rocket.Chat: https://your-rocketchat.com/hooks/YOUR_WEBHOOK_ID
# Generic: Any HTTP endpoint that accepts JSON POST requests

# Set your preferred language for AI responses
LANGUAGE=English  # Options: English, Spanish, French, German, Chinese, Japanese, Portuguese, Russian, Italian, etc.

# AI model selection (Gemma 3n is recommended for best quality)
MODEL_NAME=gemma3n:e2b  # Options: gemma3n:e2b [default], qwen3:8b, llama3.2:1b, phi3:mini
```

## 🧪 Testing

Generate realistic test errors to verify the system:
```bash
robolog test-errors
```

This creates:
- **Nginx errors** (502 Bad Gateway)
- **System errors** (disk space critical)
- **Database errors** (connection failures)
- **Memory warnings** (high usage alerts)

Check your webhook platform within 60 seconds for the AI-powered analysis in your configured language!

## 📊 Features

- **🤖 AI-Powered Analysis**: Uses Ollama with multiple model options (Gemma 3n [default], Qwen 3, LLaMA 3.2, Phi-3)
- **🌐 Multilingual Support**: Receive notifications in your preferred language (English, Spanish, French, German, Chinese, Japanese, and more)
- **📱 Multi-Platform Webhooks**: Supports Discord, Slack, Microsoft Teams, Telegram, Mattermost, Rocket.Chat, and generic webhooks
- **🔍 Multi-Level Filtering**: Automatically categorizes by severity (CRITICAL, ERROR, WARNING)
- **🏗️ Multi-Application Support**: Monitors nginx, system, database, and application logs
- **⚡ Real-time Processing**: Processes logs as they're generated
- **🔄 Auto-restart**: Resilient service management with systemd
- **🛡️ Resource Protection**: Built-in safeguards against log file overflow

## 🏗️ Architecture

### Native Installation
```
System Logs → Fluent Bit → Analyzer (Node.js) → Ollama (AI) → Webhook Platform
     ↓
/var/log/* → systemd → /opt/robolog/logs/all.log → AI Analysis → Notifications
```

### Docker Installation  
```
Container Logs → Docker Logging → Fluent Bit → Analyzer → Ollama (AI) → Webhook Platform
```

**Components:**
- **Fluent Bit**: Collects and centralizes logs (system logs for native, container logs for Docker)
- **Analyzer**: Node.js service that filters, structures, and analyzes logs
- **Ollama**: Local AI model serving (Gemma 3n [default], Qwen 3, LLaMA 3.2, or Phi-3) for intelligent analysis
- **Webhook Platform**: Multi-platform notification delivery (Discord, Slack, Teams, Telegram, etc.) with structured summaries and recommendations

## 🔄 Supported Linux Distributions

- **Ubuntu** 20.04+ / **Debian** 11+
- **CentOS** 7+ / **RHEL** 7+
- **Fedora** 35+
- **Arch Linux**