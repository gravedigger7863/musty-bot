module.exports = {
  apps: [
    {
      name: 'musty-bot',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'webhook-deploy',
      script: 'webhook-deploy.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        WEBHOOK_SECRET: 'musty-bot-deploy-secret-2025',
        WEBHOOK_PORT: 3001
      }
    }
  ]
};
