Write-Host "🍪 Extracting Firefox Cookies from Local Installation" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green

# Find Firefox profiles
$firefoxPaths = @(
    "$env:APPDATA\Mozilla\Firefox\Profiles",
    "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles"
)

$profiles = @()
foreach ($path in $firefoxPaths) {
    if (Test-Path $path) {
        $profiles += Get-ChildItem $path -Directory | Where-Object { $_.Name -like "*.default*" }
    }
}

if ($profiles.Count -eq 0) {
    Write-Host "❌ No Firefox profiles found!" -ForegroundColor Red
    Write-Host "💡 Make sure Firefox is installed and you have used it to visit YouTube" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Found $($profiles.Count) profile(s)" -ForegroundColor Cyan

foreach ($profile in $profiles) {
    Write-Host "🔍 Checking profile: $($profile.Name)" -ForegroundColor Yellow
    
    $cookiesDb = Join-Path $profile.FullName "cookies.sqlite"
    
    if (Test-Path $cookiesDb) {
        Write-Host "📤 Extracting cookies from: $cookiesDb" -ForegroundColor Cyan
        
        # Use sqlite3 to extract YouTube cookies
        $query = @"
SELECT name, value, host, path, isSecure, isHttpOnly, expiry
FROM moz_cookies 
WHERE host LIKE '%youtube%' OR host LIKE '%google%'
ORDER BY host, name;
"@
        
        try {
            $cookies = sqlite3 $cookiesDb $query
            
            if ($cookies) {
                Write-Host "✅ Found cookies!" -ForegroundColor Green
                
                # Convert to Netscape format
                $netscapeContent = "# Netscape HTTP Cookie File`n# This is a generated file! Do not edit.`n`n"
                
                $cookieLines = $cookies -split "`n" | Where-Object { $_.Trim() -ne "" }
                
                foreach ($line in $cookieLines) {
                    $parts = $line -split '\|'
                    if ($parts.Length -ge 7) {
                        $name = $parts[0]
                        $value = $parts[1]
                        $host = $parts[2]
                        $path = $parts[3]
                        $isSecure = $parts[4]
                        $isHttpOnly = $parts[5]
                        $expiry = $parts[6]
                        
                        $domain = if ($host.StartsWith('.')) { $host } else { ".$host" }
                        $secure = if ($isSecure -eq '1') { 'TRUE' } else { 'FALSE' }
                        $httpOnly = if ($isHttpOnly -eq '1') { 'TRUE' } else { 'FALSE' }
                        $expires = if ($expiry -and $expiry -ne '0') { $expiry } else { '0' }
                        
                        $netscapeContent += "$domain`tTRUE`t$path`t$secure`t$expires`t$name`t$value`n"
                    }
                }
                
                $netscapeContent | Out-File -FilePath "cookies.txt" -Encoding UTF8
                Write-Host "📁 Cookies saved to: cookies.txt" -ForegroundColor Green
                Write-Host "📤 Upload to VPS: scp cookies.txt root@94.130.97.149:/root/musty-bot/" -ForegroundColor Cyan
                exit 0
            }
        }
        catch {
            Write-Host "❌ Failed to extract cookies: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "❌ No YouTube cookies found in any profile" -ForegroundColor Red
Write-Host "💡 Try visiting YouTube in Firefox first, then run this script again" -ForegroundColor Yellow
