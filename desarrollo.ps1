# Modo desarrollo: el API .NET en 5080 y Angular con recarga en caliente en 4200.
# Uso: ./desarrollo.ps1   ->  http://localhost:4200
$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot

$api = Start-Process dotnet -ArgumentList 'run', '--launch-profile', 'http' `
    -WorkingDirectory "$raiz\servidor" -PassThru

Push-Location "$raiz\cliente"
try {
    if (-not (Test-Path node_modules)) { npm install }
    npx ng serve --open
} finally {
    Stop-Process -Id $api.Id -ErrorAction SilentlyContinue
    Pop-Location
}
