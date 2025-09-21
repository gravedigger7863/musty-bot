# Live Log Viewer - PowerShell version
# Stream bot logs from VPS with color coding

Write-Host "🔍 Starting live log viewer..." -ForegroundColor Blue
Write-Host "📡 Connecting to VPS: 94.130.97.149" -ForegroundColor Yellow
Write-Host "📋 Streaming musty-bot logs..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

try {
    # Connect to VPS and stream logs
    ssh root@94.130.97.149 "tail -f /root/.pm2/logs/musty-bot-out.log" | ForEach-Object {
        $line = $_
        
        # Color code different types of logs
        if ($line -match "ERROR|error") {
            Write-Host $line -ForegroundColor Red
        } elseif ($line -match "WARN|warn") {
            Write-Host $line -ForegroundColor Yellow
        } elseif ($line -match "✅|SUCCESS") {
            Write-Host $line -ForegroundColor Green
        } elseif ($line -match "🔍|search") {
            Write-Host $line -ForegroundColor Blue
        } elseif ($line -match "🎵|music") {
            Write-Host $line -ForegroundColor Magenta
        } elseif ($line -match "📊|Performance") {
            Write-Host $line -ForegroundColor Cyan
        } else {
            Write-Host $line -ForegroundColor White
        }
    }
} catch {
    Write-Host "❌ Error connecting to VPS: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure you have SSH access to the VPS and the bot is running." -ForegroundColor Yellow
}
