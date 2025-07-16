module.exports = {
    apps: [
        {
            name: 'demo-app',
            script: 'node_modules/next/dist/bin/next',
            args: 'start -p 3000',
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: 'production'
            },
            // ✅ FIX: Pipe PM2's output to the container's standard streams.
            // This is the critical step that makes Next.js logs visible to Fluent Bit.
            output: 'inherit',
            error: 'inherit'
        }
    ]
};
