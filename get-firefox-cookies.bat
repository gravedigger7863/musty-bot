@echo off
echo 🍪 Firefox Cookie Extractor
echo ==========================

echo 📁 Looking for Firefox profiles...

set "PROFILE_PATH=%APPDATA%\Mozilla\Firefox\Profiles"
if not exist "%PROFILE_PATH%" (
    echo ❌ Firefox profiles not found at %PROFILE_PATH%
    goto :end
)

echo ✅ Found Firefox profiles at: %PROFILE_PATH%

for /d %%i in ("%PROFILE_PATH%\*") do (
    echo 🔍 Checking profile: %%~ni
    set "COOKIES_DB=%%i\cookies.sqlite"
    
    if exist "!COOKIES_DB!" (
        echo 📤 Found cookies database: !COOKIES_DB!
        echo.
        echo 💡 Manual extraction needed:
        echo 1. Open Firefox
        echo 2. Go to YouTube and make sure you're logged in
        echo 3. Press F12 to open Developer Tools
        echo 4. Go to Application/Storage → Cookies → https://www.youtube.com
        echo 5. Copy the important cookies (VISITOR_INFO1_LIVE, YSC, PREF, etc.)
        echo 6. Create cookies.txt with this format:
        echo.
        echo # Netscape HTTP Cookie File
        echo # This is a generated file! Do not edit.
        echo.
        echo .youtube.com	TRUE	/	FALSE	0	VISITOR_INFO1_LIVE	your_value_here
        echo .youtube.com	TRUE	/	FALSE	0	YSC	your_value_here
        echo .youtube.com	TRUE	/	FALSE	0	PREF	your_value_here
        echo.
        goto :end
    )
)

:end
echo.
echo Press any key to continue...
pause > nul
