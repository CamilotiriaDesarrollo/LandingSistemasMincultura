# Compila la landing y la sirve desde .NET en un solo puerto.
# Uso: ./iniciar.ps1     ->  http://localhost:5080
$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot

Write-Host "Compilando el cliente Angular..." -ForegroundColor Cyan
Push-Location "$raiz\cliente"
try {
    if (-not (Test-Path node_modules)) { npm install }
    npx ng build
} finally { Pop-Location }

Write-Host "Iniciando el servidor .NET..." -ForegroundColor Cyan
$servidor = Start-Process dotnet -ArgumentList 'run', '--launch-profile', 'http' `
    -WorkingDirectory "$raiz\servidor" -PassThru -NoNewWindow

# Espera a que el API responda antes de abrir el navegador.
foreach ($i in 1..60) {
    try {
        Invoke-WebRequest http://localhost:5080/api/health -UseBasicParsing -TimeoutSec 2 | Out-Null
        break
    } catch { Start-Sleep -Seconds 1 }
}
Write-Host "Landing lista en http://localhost:5080  (Ctrl+C para detener)" -ForegroundColor Green
Start-Process 'http://localhost:5080'
Wait-Process -Id $servidor.Id
