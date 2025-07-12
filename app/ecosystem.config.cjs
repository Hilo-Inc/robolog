module.exports = {
    apps: [
        {
            name: 'demo-app',
            // ✅ BEST PRACTICE: Use npm to run the start script from package.json.
            // This makes PM2 a pure process manager and avoids module loading issues.
            script: 'npm',
            args: 'start',
            // The 'interpreter' is no longer needed when using npm.
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
