@echo off
echo 🍪 Firefox Cookie Exporter for yt-dlp
echo =====================================

echo 📤 Exporting cookies from Firefox...
yt-dlp --cookies-from-browser firefox --cookies cookies.txt --print cookies

if exist cookies.txt (
    echo ✅ Cookies exported successfully!
    echo 📁 Cookies saved to: cookies.txt
    echo.
    echo 📋 Next steps:
    echo 1. Upload cookies.txt to your VPS: scp cookies.txt root@94.130.97.149:/root/musty-bot/
    echo 2. Or copy the contents and create the file on the VPS
    echo 3. The bot will automatically use the cookies file if it exists
) else (
    echo ❌ Failed to export cookies
    echo 📝 Creating a basic cookies file...
    
    echo # Netscape HTTP Cookie File > cookies.txt
    echo # This is a generated file! Do not edit. >> cookies.txt
    echo. >> cookies.txt
    echo .youtube.com	TRUE	/	FALSE	0	VISITOR_INFO1_LIVE	1 >> cookies.txt
    echo .youtube.com	TRUE	/	FALSE	0	YSC	1 >> cookies.txt
    echo .youtube.com	TRUE	/	FALSE	0	PREF	1 >> cookies.txt
    
    echo ✅ Basic cookies file created: cookies.txt
    echo ⚠️  Note: This is a basic file. For best results, use a real browser session.
)

pause
