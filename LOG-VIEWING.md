# 📋 Live Log Viewing Options

You now have multiple ways to view live logs from your VPS on your local PC:

## 🚀 **Option 1: Node.js Script (Recommended)**
```bash
npm run logs
```
- **Features**: Color-coded logs, error handling, clean output
- **Requirements**: Node.js installed
- **Best for**: Developers who want formatted output

## 🖥️ **Option 2: Batch File (Windows)**
```bash
view-logs.bat
```
- **Features**: Simple, no dependencies
- **Requirements**: SSH access to VPS
- **Best for**: Quick and easy log viewing

## 💻 **Option 3: PowerShell Script**
```powershell
.\view-logs.ps1
```
- **Features**: Color-coded output, Windows-native
- **Requirements**: PowerShell, SSH access
- **Best for**: Windows users who want colors

## 🔧 **Option 4: Direct SSH Command**
```bash
ssh root@94.130.97.149 "tail -f /root/.pm2/logs/musty-bot-out.log"
```
- **Features**: Raw log output
- **Requirements**: SSH access to VPS
- **Best for**: Advanced users

## 📊 **Log Color Coding (Node.js & PowerShell)**
- 🔴 **Red**: Errors and failures
- 🟡 **Yellow**: Warnings and alerts
- 🟢 **Green**: Success messages and confirmations
- 🔵 **Blue**: Search operations and information
- 🟣 **Magenta**: Music-related events
- 🔵 **Cyan**: Performance metrics and monitoring
- ⚪ **White**: General log messages

## 🛠️ **Troubleshooting**

### If SSH connection fails:
1. Make sure you have SSH access to the VPS
2. Check if the bot is running: `ssh root@94.130.97.149 "pm2 status musty-bot"`
3. Verify the log file exists: `ssh root@94.130.97.149 "ls -la /root/.pm2/logs/"`

### If you see "command not found":
1. Make sure you're in the bot directory
2. Install dependencies: `npm install`
3. Try the direct SSH command instead

## 🎯 **Quick Start**
1. Open terminal in the bot directory
2. Run: `npm run logs`
3. Watch the live logs stream in real-time!
4. Press `Ctrl+C` to stop

**Happy debugging!** 🐛✨
