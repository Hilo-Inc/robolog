module.exports = {
    apps: [
        {
            name: 'demo-app',
            // ✅ FIX: Use npm to run the start script from package.json.
            // This is a more standard and robust approach that avoids the argument-passing
            // issues seen when calling the 'next' binary directly from PM2.
            script: 'npm',
            args: 'start',
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
