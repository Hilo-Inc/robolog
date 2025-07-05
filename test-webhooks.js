// Test script for webhook functionality
import fetch from 'node-fetch';

// Test all webhook platforms
const platforms = ['discord', 'slack', 'teams', 'telegram', 'mattermost', 'rocketchat', 'generic'];

function formatWebhookPayload(message, platform) {
    const truncatedMessage = message.slice(0, 3900);
    
    switch (platform.toLowerCase()) {
        case 'discord':
            return {
                content: truncatedMessage.slice(0, 1900)
            };
            
        case 'slack':
            return {
                text: truncatedMessage,
                mrkdwn: true,
                username: "Robolog",
                icon_emoji: ":robot_face:"
            };
            
        case 'teams':
            return {
                "@type": "MessageCard",
                "@context": "http://schema.org/extensions",
                "themeColor": "0076D7",
                "summary": "Robolog Alert",
                "sections": [{
                    "activityTitle": "🤖 Robolog Alert",
                    "activitySubtitle": "AI Log Analysis (English)",
                    "text": truncatedMessage,
                    "markdown": true
                }]
            };
            
        case 'telegram':
            return {
                text: truncatedMessage,
                parse_mode: "Markdown",
                disable_web_page_preview: true
            };
            
        case 'mattermost':
            return {
                text: truncatedMessage,
                username: "Robolog",
                icon_emoji: ":robot_face:"
            };
            
        case 'rocketchat':
            return {
                text: truncatedMessage,
                username: "Robolog",
                emoji: ":robot_face:"
            };
            
        case 'webhook':
        case 'generic':
        default:
            return {
                message: truncatedMessage,
                platform: "robolog",
                timestamp: new Date().toISOString(),
                language: "English",
                source: "ai-log-analysis"
            };
    }
}

// Test function
function testWebhookPayloads() {
    console.log('🧪 Testing Webhook Payload Formatting...\n');
    
    const testMessage = `🤖 AI Log Analysis (English):

🚨 CRITICAL ISSUES
- Database connection failed after 3 retries
- /var/log partition at 95% capacity

⚠️ WARNINGS  
- High memory usage detected (90%)
- Multiple 502 errors from upstream

🔧 RECOMMENDED ACTIONS
1. Restart database service
2. Clear old log files
3. Monitor memory usage`;

    platforms.forEach(platform => {
        console.log(`\n--- ${platform.toUpperCase()} ---`);
        const payload = formatWebhookPayload(testMessage, platform);
        console.log(JSON.stringify(payload, null, 2));
    });
    
    console.log('\n✅ All webhook payloads formatted successfully!');
}

// Run the test
testWebhookPayloads(); 