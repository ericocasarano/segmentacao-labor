$ErrorActionPreference = "Stop"

$user = Read-Host "Usuario do dashboard"
$securePassword = Read-Host "Senha do dashboard" -AsSecureString

$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

$sha1 = [Security.Cryptography.SHA1]::Create()
$bytes = [Text.Encoding]::UTF8.GetBytes($plainPassword)
$hash = [Convert]::ToBase64String($sha1.ComputeHash($bytes))
$line = "${user}:{SHA}${hash}"

$outPath = Join-Path $PSScriptRoot "publish\.htpasswd"
Set-Content -Path $outPath -Value $line -Encoding ASCII

Write-Host ""
Write-Host "Arquivo criado: $outPath"
Write-Host "Suba publish\.htaccess e publish\.htpasswd para a pasta do dashboard no FTP."
