@echo off
echo 🍪 Setting up local Firefox cookies for yt-dlp...
echo.
echo This will extract cookies from your local Firefox and upload them to the VPS.
echo Make sure you're signed into YouTube in Firefox first!
echo.
pause

echo 🔍 Extracting cookies from local Firefox...
yt-dlp --cookies-from-browser firefox --cookies cookies.txt --dump-cookies "https://www.youtube.com" > nul 2>&1

if exist cookies.txt (
    echo ✅ Cookies extracted successfully!
    echo 📤 Uploading cookies to VPS...
    
    scp cookies.txt root@94.130.97.149:/root/musty-bot/cookies.txt
    
    if %errorlevel% == 0 (
        echo ✅ Cookies uploaded successfully!
        echo 🧹 Cleaning up local cookies file...
        del cookies.txt
        echo.
        echo 🎯 Cookies are now ready on the VPS!
        echo The bot will use these cookies for YouTube downloads.
    ) else (
        echo ❌ Failed to upload cookies to VPS
    )
) else (
    echo ❌ Failed to extract cookies from Firefox
    echo Make sure you're signed into YouTube in Firefox first!
)

pause
