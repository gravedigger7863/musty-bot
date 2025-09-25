const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🍪 Extracting Firefox Cookies from Local Installation');
console.log('=====================================================');

// Common Firefox profile locations on Windows
const firefoxPaths = [
  path.join(process.env.APPDATA, 'Mozilla', 'Firefox', 'Profiles'),
  path.join(process.env.LOCALAPPDATA, 'Mozilla', 'Firefox', 'Profiles'),
  'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles',
  'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Mozilla\\Firefox\\Profiles'
];

function findFirefoxProfiles() {
  for (const firefoxPath of firefoxPaths) {
    if (fs.existsSync(firefoxPath)) {
      console.log(`📁 Found Firefox profiles at: ${firefoxPath}`);
      const profiles = fs.readdirSync(firefoxPath).filter(dir => 
        fs.statSync(path.join(firefoxPath, dir)).isDirectory() && 
        dir.includes('.default')
      );
      
      if (profiles.length > 0) {
        return profiles.map(profile => path.join(firefoxPath, profile));
      }
    }
  }
  return [];
}

function extractCookiesFromProfile(profilePath) {
  return new Promise((resolve, reject) => {
    const cookiesDb = path.join(profilePath, 'cookies.sqlite');
    
    if (!fs.existsSync(cookiesDb)) {
      console.log(`❌ No cookies database found at: ${cookiesDb}`);
      resolve(null);
      return;
    }
    
    console.log(`📤 Extracting cookies from: ${cookiesDb}`);
    
    // Use sqlite3 to extract YouTube cookies
    const sqlite = spawn('sqlite3', [cookiesDb, `
      SELECT name, value, host, path, isSecure, isHttpOnly, expiry
      FROM moz_cookies 
      WHERE host LIKE '%youtube%' OR host LIKE '%google%'
      ORDER BY host, name;
    `]);
    
    let output = '';
    let error = '';
    
    sqlite.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    sqlite.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    sqlite.on('close', (code) => {
      if (code === 0 && output.trim()) {
        console.log(`✅ Found ${output.split('\n').filter(line => line.trim()).length} cookies`);
        resolve(output);
      } else {
        console.log(`❌ Failed to extract cookies: ${error}`);
        resolve(null);
      }
    });
  });
}

function convertToNetscapeFormat(sqliteOutput) {
  const lines = sqliteOutput.split('\n').filter(line => line.trim());
  let netscapeContent = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\n';
  
  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length >= 7) {
      const [name, value, host, path, isSecure, isHttpOnly, expiry] = parts;
      const domain = host.startsWith('.') ? host : '.' + host;
      const secure = isSecure === '1' ? 'TRUE' : 'FALSE';
      const httpOnly = isHttpOnly === '1' ? 'TRUE' : 'FALSE';
      const expires = expiry && expiry !== '0' ? expiry : '0';
      
      netscapeContent += `${domain}\tTRUE\t${path}\t${secure}\t${expires}\t${name}\t${value}\n`;
    }
  }
  
  return netscapeContent;
}

async function main() {
  try {
    console.log('🔍 Searching for Firefox profiles...');
    const profiles = findFirefoxProfiles();
    
    if (profiles.length === 0) {
      console.log('❌ No Firefox profiles found!');
      console.log('💡 Make sure Firefox is installed and you have used it to visit YouTube');
      return;
    }
    
    console.log(`📋 Found ${profiles.length} profile(s)`);
    
    for (const profile of profiles) {
      console.log(`\n🔍 Checking profile: ${path.basename(profile)}`);
      const cookies = await extractCookiesFromProfile(profile);
      
      if (cookies) {
        console.log('✅ Successfully extracted cookies!');
        const netscapeFormat = convertToNetscapeFormat(cookies);
        
        fs.writeFileSync('cookies.txt', netscapeFormat);
        console.log('📁 Cookies saved to: cookies.txt');
        console.log('📤 Upload to VPS: scp cookies.txt root@94.130.97.149:/root/musty-bot/');
        return;
      }
    }
    
    console.log('❌ No YouTube cookies found in any profile');
    console.log('💡 Try visiting YouTube in Firefox first, then run this script again');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
