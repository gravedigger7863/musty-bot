const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3001;
const SECRET = process.env.WEBHOOK_SECRET || 'your-secret-key';

// Middleware to parse JSON
app.use(express.json());

// Verify GitHub webhook signature
function verifySignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payload, 'utf8');
  const digest = 'sha256=' + hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Auto-deployment endpoint
app.post('/deploy', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);
  
  // Verify webhook signature (optional but recommended)
  if (signature && !verifySignature(payload, signature)) {
    console.log('❌ Invalid webhook signature');
    return res.status(401).send('Unauthorized');
  }
  
  // Check if it's a push to main branch
  if (req.body.ref === 'refs/heads/main') {
    console.log('🚀 Auto-deployment triggered by push to main branch');
    
    // Run deployment commands with git stash to handle conflicts
    exec('cd /root/musty-bot && git stash push -m "Auto-stash before deployment $(date)" && git pull origin main && npm install && pm2 restart musty-bot', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Deployment failed:', error);
        return res.status(500).send('Deployment failed');
      }
      
      console.log('✅ Deployment successful');
      console.log('📋 Output:', stdout);
      if (stderr) console.log('⚠️ Warnings:', stderr);
      
      res.status(200).send('Deployment successful');
    });
  } else {
    console.log('ℹ️ Push to non-main branch, skipping deployment');
    res.status(200).send('Push to non-main branch, no deployment needed');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🔗 Webhook server running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://your-vps-ip:${PORT}/deploy`);
  console.log(`🔐 Secret: ${SECRET}`);
});
