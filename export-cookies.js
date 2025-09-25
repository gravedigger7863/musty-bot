const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🍪 Firefox Cookie Exporter for yt-dlp');
console.log('=====================================');

// Function to export cookies from Firefox
function exportFirefoxCookies() {
  return new Promise((resolve, reject) => {
    console.log('📤 Exporting cookies from Firefox...');
    
    const ytdlp = spawn('yt-dlp', [
      '--cookies-from-browser', 'firefox',
      '--cookies', 'cookies.txt',
      '--print', 'cookies',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // Dummy URL just to extract cookies
    ]);
    
    let output = '';
    let error = '';
    
    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ytdlp.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    ytdlp.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Cookies exported successfully!');
        console.log('📁 Cookies saved to: cookies.txt');
        console.log('📤 You can now upload this file to your VPS');
        resolve();
      } else {
        console.error('❌ Failed to export cookies:', error);
        reject(new Error(error));
      }
    });
  });
}

// Function to create a simple cookies file if yt-dlp fails
function createSimpleCookiesFile() {
  console.log('📝 Creating a basic cookies file...');
  
  const cookiesContent = `# Netscape HTTP Cookie File
# This is a generated file! Do not edit.

.youtube.com	TRUE	/	FALSE	0	VISITOR_INFO1_LIVE	1
.youtube.com	TRUE	/	FALSE	0	YSC	1
.youtube.com	TRUE	/	FALSE	0	PREF	1
`;

  fs.writeFileSync('cookies.txt', cookiesContent);
  console.log('✅ Basic cookies file created: cookies.txt');
  console.log('⚠️  Note: This is a basic file. For best results, use a real browser session.');
}

// Main execution
async function main() {
  try {
    await exportFirefoxCookies();
  } catch (error) {
    console.log('⚠️  yt-dlp cookie export failed, creating basic file...');
    createSimpleCookiesFile();
  }
  
  console.log('\n📋 Next steps:');
  console.log('1. Upload cookies.txt to your VPS: scp cookies.txt root@94.130.97.149:/root/musty-bot/');
  console.log('2. Or copy the contents and create the file on the VPS');
  console.log('3. The bot will automatically use the cookies file if it exists');
}

main().catch(console.error);
