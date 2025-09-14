#!/usr/bin/env node

/**
 * Script to trigger deployment on VPS
 * This will send a webhook request to trigger the deployment
 */

const https = require('https');
const http = require('http');

const VPS_IP = '94.130.97.149';
const WEBHOOK_PORT = 3001;

const deploymentData = {
  ref: 'refs/heads/main',
  commits: [{
    id: '18ce4d0',
    message: 'Add comprehensive debugging and fix queue/connection issues'
  }]
};

const postData = JSON.stringify(deploymentData);

const options = {
  hostname: VPS_IP,
  port: WEBHOOK_PORT,
  path: '/deploy',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🚀 Triggering deployment on VPS...');
console.log(`📡 Sending to: http://${VPS_IP}:${WEBHOOK_PORT}/deploy`);
console.log(`📋 Data:`, deploymentData);

const req = http.request(options, (res) => {
  console.log(`📊 Status: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`📄 Response: ${data}`);
    if (res.statusCode === 200) {
      console.log('✅ Deployment triggered successfully!');
    } else {
      console.log('❌ Deployment failed or webhook not working');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error triggering deployment:', error.message);
});

req.write(postData);
req.end();
