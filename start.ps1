# DataGrid dev launcher — kills stale processes, then starts backend + frontend.
# Usage: .\start.ps1

Write-Host "Starting DataGrid..." -ForegroundColor Cyan

# ── Kill anything holding port 8000 ─────────────────────────────────────────
$procs = netstat -ano 2>$null | Select-String ":8000\s"
foreach ($line in $procs) {
    $procId = ($line.ToString().Trim() -split '\s+')[-1]
    if ($procId -match '^\d+$' -and [int]$procId -ne 0) {
        Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
    }
}

# ── Backend ──────────────────────────────────────────────────────────────────
Write-Host "Starting backend on :8000" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$PSScriptRoot\backend'; .\venv\Scripts\Activate.ps1; uvicorn main:app --reload --port 8000"

Start-Sleep 3

# ── Frontend ─────────────────────────────────────────────────────────────────
Write-Host "Starting frontend on :5174" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5174" -ForegroundColor Yellow
