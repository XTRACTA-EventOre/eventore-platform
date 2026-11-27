param([string]$AppBaseUrl = 'http://localhost:5173')
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoPath '.env'
if (Test-Path -LiteralPath $envPath) { throw 'Ya existe .env; se conserva sin cambios. Revisa .env.compose.example para agregar variables nuevas.' }
$origin = [Uri]$AppBaseUrl
if ($origin.Scheme -notin @('http','https') -or $origin.AbsolutePath -ne '/') { throw 'Usa el origen del frontend, sin rutas.' }
function New-RandomHex {
  param([int]$ByteCount)
  $bytes = New-Object byte[] $ByteCount
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) }
  finally { $generator.Dispose() }
  return [BitConverter]::ToString($bytes).Replace('-','').ToLowerInvariant()
}
$lines = @('APP_BASE_URL=' + $origin.GetLeftPart([System.UriPartial]::Authority))
foreach ($service in @('IDENTITY','TRACEABILITY','LOGISTICS','PROCESSING','JEWELRY','CERTIFICATION','DEVICES','REPORTING')) {
  $lines += $service + '_DB_PASSWORD=' + (New-RandomHex -ByteCount 24)
}
$lines += 'INTERNAL_AUTH_SECRET=' + (New-RandomHex -ByteCount 32)
$lines += 'BILLING_PROVIDER_SECRET=' + (New-RandomHex -ByteCount 32)
[System.IO.File]::WriteAllLines($envPath,$lines,[System.Text.UTF8Encoding]::new($false))
Write-Output 'Se creó .env con credenciales aleatorias. No se imprimen sus valores. Ejecuta docker compose up -d --build.'
