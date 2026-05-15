# Smart Production Workflow — Start Script
# Usage: .\start.ps1
# Optional: .\start.ps1 -NoOllama -NoMcp

param(
    [switch]$NoOllama,
    [switch]$NoMcp
)

$root = $PSScriptRoot

function Open-Terminal($title, $command) {
    # Try Windows Terminal first, fallback to PowerShell window
    if (Get-Command wt -ErrorAction SilentlyContinue) {
        Start-Process wt -ArgumentList "new-tab --title `"$title`" powershell -NoExit -Command `"$command`""
    } else {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $command `
            -WindowStyle Normal
    }
}

Write-Host ""
Write-Host "  Smart Production Workflow" -ForegroundColor Cyan
Write-Host "  ─────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# 1. Ollama
if (-not $NoOllama) {
    Write-Host "  [1/4] Starting Ollama..." -ForegroundColor Yellow
    Start-Process ollama -ArgumentList "serve" -WindowStyle Minimized -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "        Ollama running" -ForegroundColor Green
}

# 2. Backend
Write-Host "  [2/4] Starting Backend  (http://localhost:3000)..." -ForegroundColor Yellow
Open-Terminal "Backend" "cd '$root\backend'; npm run dev"
Start-Sleep -Seconds 1

# 3. MCP Server
if (-not $NoMcp) {
    Write-Host "  [3/4] Starting MCP Server..." -ForegroundColor Yellow
    Open-Terminal "MCP Server" "cd '$root\backend'; npm run mcp"
    Start-Sleep -Seconds 1
}

# 4. Frontend
Write-Host "  [4/4] Starting Frontend (http://localhost:3001)..." -ForegroundColor Yellow
Open-Terminal "Frontend" "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "  All services started." -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Backend:   http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login: admin / admin" -ForegroundColor DarkGray
Write-Host ""
