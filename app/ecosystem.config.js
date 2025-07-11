module.exports = {
    apps: [
        {
            name: 'demo-app',
            script: 'index.mjs',
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
