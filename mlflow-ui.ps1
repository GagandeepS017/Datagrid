# DataGrid — MLflow UI launcher.
# Opens the experiment-tracking dashboard for the NL->SQL eval harness.
# Usage:  .\mlflow-ui.ps1   then open http://localhost:5000
#
# Note: MLflow 3.x disables the file store unless MLFLOW_ALLOW_FILE_STORE=true,
# so this script sets it for you — that's the step that's easy to miss manually.

Write-Host "Starting MLflow UI..." -ForegroundColor Cyan

$env:MLFLOW_ALLOW_FILE_STORE = "true"
Set-Location "$PSScriptRoot\backend"
& .\venv\Scripts\Activate.ps1

Write-Host "Experiment store: $PSScriptRoot\backend\mlruns" -ForegroundColor DarkGray
Write-Host "Dashboard:        http://localhost:5000" -ForegroundColor Yellow
Write-Host "(Press Ctrl+C in this window to stop)" -ForegroundColor DarkGray
Write-Host ""

mlflow ui --backend-store-uri file:./mlruns --port 5000
