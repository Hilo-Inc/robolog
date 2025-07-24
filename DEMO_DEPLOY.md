# 🚀 Robolog Public Demo Deployment Guide

## Quick Deployment Options (Fastest to Most Comprehensive)

### Option 1: DigitalOcean App Platform (⚡ 5 minutes)
**Perfect for: Professional demos, client presentations**

1. **Go to** [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. **Connect your GitHub** account and select your robolog repository
3. **Use the included** `.do/app.yaml` configuration
4. **Set environment variables:**
   - `WEBHOOK_URL`: Your Discord/Slack webhook (optional)
   - `MODEL_NAME`: `llama3.2:1b` (smaller/faster for demos)
5. **Deploy** and get your public URL

**Pros:** Professional hosting, automatic SSL, good performance
**Cons:** Requires DigitalOcean account, basic plan costs ~$5/month

---

### Option 2: AWS App Runner + ECR (⚡ 8 minutes)
**Perfect for: Professional AWS demos, serverless scaling**

1. **Prerequisites:** AWS CLI configured with appropriate permissions
2. **One-command deployment:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/your-username/robolog/main/deploy/aws-apprunner-setup.sh | bash
   ```
3. **Get your public HTTPS URL** automatically
4. **Automatic scaling** and managed infrastructure

**Pros:** Serverless, automatic HTTPS, managed infrastructure, auto-scaling
**Cons:** AWS-specific, requires AWS CLI setup
**Cost:** ~$0.064/hour (~$46/month) for 2vCPU, 4GB RAM

---

### Option 3: AWS EC2 with Docker Compose (⚡ 10 minutes)
**Perfect for: Full-featured demos, production testing**

#### Quick Setup:
```bash
# 1. Launch EC2 instance (t3.large or bigger, Ubuntu 22.04)
# 2. SSH into your instance and run:

curl -fsSL https://raw.githubusercontent.com/your-username/robolog/main/deploy/aws-demo-setup.sh | bash

# 3. Reboot to apply Docker group permissions:
sudo reboot

# 4. After reboot, start the demo:
cd robolog
docker-compose -f docker-compose.demo.yml up -d
```

#### Manual Setup:
1. **Launch EC2 Instance:**
   - AMI: Ubuntu 22.04 LTS
   - Instance Type: t3.large (minimum 8GB RAM for AI models)
   - Security Group: Allow HTTP (80), HTTPS (443), SSH (22)

2. **Install Dependencies:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Deploy Robolog:**
   ```bash
   git clone https://github.com/your-username/robolog.git
   cd robolog
   
   # Create demo environment
   echo "WEBHOOK_URL=" > .env
   echo "MODEL_NAME=llama3.2:1b" >> .env
   echo "LANGUAGE=English" >> .env
   echo "WEBHOOK_PLATFORM=discord" >> .env
   
   # Start the demo
   docker-compose -f docker-compose.demo.yml up -d
   ```

4. **Access Your Demo:**
   - Dashboard: `http://YOUR-EC2-IP/`
   - Testing Tools: `http://YOUR-EC2-IP/testing`

**Pros:** Full control, can handle multiple users, all features work
**Cons:** Requires AWS account, ~$0.10/hour while running

---

## Demo Usage Instructions

Once your demo is deployed:

### 1. Configure Notifications (Optional)
- Go to `/testing` page
- Add your Discord/Slack webhook URL
- This enables real-time notifications of AI analysis

### 2. Generate Test Errors
Two methods available:
- **"Generate Realistic Errors"** - Creates various system errors via log files
- **"Test Analyzer Directly"** - Sends test data directly to AI analyzer

### 3. View AI Analysis
- Check the main Dashboard for real-time AI reports
- Click "View Details" on any report for full analysis
- Use the follow-up feature to ask specific questions about errors

### 4. Demo Features to Highlight
- **Real-time AI analysis** of system logs
- **Multi-severity detection** (Critical, Error, Warning)
- **Intelligent summaries** with actionable recommendations
- **Follow-up questioning** for deeper analysis
- **Multi-platform notifications** (Discord, Slack, Teams, etc.)
- **Modern web interface** with real-time updates

---

## Cost Estimates

| Platform | Setup Time | Monthly Cost | Best For |
|----------|------------|--------------|----------|
| DigitalOcean | 5 min | $5-12/month | Professional demos |
| AWS App Runner | 8 min | ~$46/month | AWS demos, auto-scaling |
| AWS EC2 t3.large | 10 min | ~$70/month* | Full demos |

*EC2 costs can be reduced by stopping the instance when not demoing

---

## Troubleshooting

### Common Issues:
1. **AI responses are slow** - Use `llama3.2:1b` model for faster responses
2. **Out of memory** - Ensure at least 8GB RAM available
3. **Webhooks not working** - Check URL format and platform selection
4. **No test errors appearing** - Wait 15-30 seconds after triggering tests

### Quick Fixes:
```bash
# Restart all services
docker-compose -f docker-compose.demo.yml restart

# Check service status
docker-compose -f docker-compose.demo.yml ps

# View logs
docker-compose -f docker-compose.demo.yml logs analyzer
```

---

## Demo Script Suggestions

**5-minute demo flow:**
1. Show the clean dashboard interface
2. Go to Testing Tools, generate errors
3. Return to dashboard, show real-time AI analysis appearing
4. Click "View Details" to show comprehensive analysis
5. Demonstrate follow-up questions feature
6. Show webhook notification (if configured)

**Key talking points:**
- "This is real AI analysis, not templated responses"
- "Works with any log format or system"
- "Scales from single servers to enterprise deployments"
- "Self-hosted AI - your logs never leave your infrastructure"

## Recommended Demo Approach

**For quickest setup:** Use **DigitalOcean App Platform** (5 minutes)
**For AWS environments:** Use **AWS App Runner + ECR** (8 minutes)  
**For full features:** Use **AWS EC2** (10 minutes)

All options provide:
- ✅ Public HTTPS URL
- ✅ AI-powered log analysis
- ✅ Interactive testing tools
- ✅ Real-time dashboard updates
- ✅ Professional UI 