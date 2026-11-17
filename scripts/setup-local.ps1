param([string]$AppBaseUrl = 'http://localhost:5173')
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoPath '.env'
if (Test-Path -LiteralPath $envPath) { throw 'Ya existe .env; se conserva sin cambios. Revisa .env.compose.example para agregar variables nuevas.' }
$origin = [Uri]$AppBaseUrl
if ($origin.Scheme -notin @('http','https') -or $origin.AbsolutePath -ne '/') { throw 'Usa el origen del frontend, sin rutas.' }
$lines = @('APP_BASE_URL=' + $origin.GetLeftPart([System.UriPartial]::Authority))
foreach ($service in @('IDENTITY','TRACEABILITY','LOGISTICS','PROCESSING','JEWELRY','CERTIFICATION','DEVICES','REPORTING')) {
  $randomBytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
  $lines += $service + '_DB_PASSWORD=' + [Convert]::ToHexString($randomBytes).ToLowerInvariant()
}
$secretBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)
$lines += 'INTERNAL_AUTH_SECRET=' + [Convert]::ToHexString($secretBytes).ToLowerInvariant()
[System.IO.File]::WriteAllLines($envPath,$lines,[System.Text.UTF8Encoding]::new($false))
Write-Output 'Se creó .env con credenciales aleatorias. No se imprimen sus valores. Ejecuta docker compose up -d --build.'
