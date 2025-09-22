/**
 * Extract Firefox cookies for yt-dlp
 * This script extracts cookies from your local Firefox browser
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Get Firefox profile path based on OS
function getFirefoxProfilePath() {
  const platform = os.platform();
  let basePath;
  
  if (platform === 'win32') {
    basePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
  } else if (platform === 'darwin') {
    basePath = path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles');
  } else {
    basePath = path.join(os.homedir(), '.mozilla', 'firefox');
  }
  
  return basePath;
}

// Find the default Firefox profile
function findDefaultProfile() {
  const profilesPath = getFirefoxProfilePath();
  
  if (!fs.existsSync(profilesPath)) {
    throw new Error('Firefox profiles directory not found');
  }
  
  const profiles = fs.readdirSync(profilesPath);
  const defaultProfile = profiles.find(profile => profile.includes('default'));
  
  if (!defaultProfile) {
    throw new Error('Default Firefox profile not found');
  }
  
  return path.join(profilesPath, defaultProfile);
}

// Extract cookies using yt-dlp
async function extractCookies() {
  try {
    console.log('🔍 Looking for Firefox profile...');
    const profilePath = findDefaultProfile();
    console.log(`✅ Found Firefox profile: ${profilePath}`);
    
    console.log('🍪 Extracting cookies...');
    
    // Use yt-dlp to extract cookies
    const ytdlp = spawn('yt-dlp', [
      '--cookies-from-browser', 'firefox',
      '--cookies', 'cookies.txt',
      '--dump-cookies',
      'https://www.youtube.com'
    ]);
    
    ytdlp.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    ytdlp.stderr.on('data', (data) => {
      console.log(data.toString());
    });
    
    ytdlp.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Cookies extracted successfully!');
        console.log('📁 Cookies saved to: cookies.txt');
        console.log('📤 Upload this file to your VPS and update the bot configuration.');
      } else {
        console.log(`❌ Cookie extraction failed with code ${code}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the extraction
extractCookies();
