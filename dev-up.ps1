#!/usr/bin/env pwsh
<#
.SYNOPSIS
  EB Insights — sobe a stack completa (Postgres + backend em Docker + Expo) num terminal só.

.DESCRIPTION
  Mirror de dev-up.sh para Windows/PowerShell 7+.
  Passos:
    1. Verifica pré-requisitos (docker daemon, node, npm).
    2. Cria/completa server\.env (merge com as chaves obrigatórias).
    3. Sobe db + server via docker compose (o container do server aplica migrations no boot).
    4. Aguarda o backend responder em http://localhost:3000/health.
    5. Inicia o Expo em foreground no terminal atual (a menos que -NoExpo).

.PARAMETER NoExpo
  Sobe só a infra (Docker) e não inicia o Expo. Útil para quem quer rodar o server
  direto do host com hot-reload (npm run dev) ou testar a API via curl.

.PARAMETER Rebuild
  Força rebuild do container do server ("docker compose up -d --build --force-recreate").
  Use depois de mudar código em server/ ou o Dockerfile.

.PARAMETER Down
  Derruba a stack Docker (preserva o volume pg_data).

.PARAMETER Nuke
  Derruba a stack E apaga o volume pg_data (destrutivo, pede confirmação).

.PARAMETER Status
  Mostra containers e tenta bater em /health.

.PARAMETER LanIp
  IP LAN do PC a ser exposto pro app (ex: 192.168.0.42). Quando presente, o script
  seta EXPO_PUBLIC_API_URL=http://<ip>:3000 e REACT_NATIVE_PACKAGER_HOSTNAME=<ip>
  antes de iniciar o Expo, para que o Expo Go em celular físico encontre o backend.
  Se omitido, o script tenta autodetectar; se detectar exatamente 1 IP LAN, usa
  automaticamente. Se detectar múltiplos ou nenhum, avisa e continua com localhost.

.EXAMPLE
  .\dev-up.ps1                       # sobe tudo e inicia Expo (autodetecta IP LAN)
  .\dev-up.ps1 -LanIp 192.168.0.42   # força um IP específico
  .\dev-up.ps1 -NoExpo               # só a infra
  .\dev-up.ps1 -Rebuild              # força rebuild do server
  .\dev-up.ps1 -Status
  .\dev-up.ps1 -Down
#>
[CmdletBinding()]
param(
  [switch]$NoExpo,
  [switch]$Rebuild,
  [switch]$Down,
  [switch]$Nuke,
  [switch]$Status,
  [string]$LanIp
)

$ErrorActionPreference = 'Stop'

$RepoRoot  = $PSScriptRoot
$ServerDir = Join-Path $RepoRoot 'server'
$EnvFile   = Join-Path $ServerDir '.env'

function Write-Log  { param([string]$Msg) Write-Host "[dev-up] $Msg" -ForegroundColor Green }
function Write-Info { param([string]$Msg) Write-Host "[dev-up] $Msg" -ForegroundColor Cyan  }
function Write-Warn { param([string]$Msg) Write-Host "[dev-up] $Msg" -ForegroundColor Yellow }
function Write-Die  { param([string]$Msg) Write-Host "[dev-up] $Msg" -ForegroundColor Red; exit 1 }

# --- Subcomandos ---
if ($Down) {
  Write-Info 'Parando Postgres (volume preservado)...'
  Push-Location $ServerDir
  try { docker compose down } finally { Pop-Location }
  Write-Log 'Stack parada. Rode .\dev-up.ps1 novamente para subir.'
  return
}

if ($Nuke) {
  Write-Warn 'Parando Postgres E apagando o volume de dados. DESTRUTIVO.'
  $ans = Read-Host "Digite 'sim' para confirmar"
  if ($ans -ne 'sim') { Write-Die 'Abortado.' }
  Push-Location $ServerDir
  try { docker compose down -v } finally { Pop-Location }
  Write-Log 'Volume pg_data removido.'
  return
}

if ($Status) {
  Write-Info 'Containers (docker compose ps):'
  Push-Location $ServerDir
  try { docker compose ps } finally { Pop-Location }
  Write-Host ''
  Write-Info 'Health endpoint:'
  try {
    $resp = Invoke-RestMethod -Uri 'http://localhost:3000/health' -TimeoutSec 2
    $resp | ConvertTo-Json -Compress | Write-Host
  } catch {
    Write-Warn 'Backend não está respondendo em http://localhost:3000/health'
  }
  return
}

# --- 1. Pré-requisitos ---
Write-Log 'Verificando pré-requisitos...'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Write-Die 'Docker não encontrado no PATH (instale Docker Desktop)' }
& docker info *>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Die 'Docker daemon não está rodando (abra o Docker Desktop)' }
& docker compose version *>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Die "'docker compose' (plugin v2) não disponível" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Die 'Node não encontrado (instale Node.js 22 LTS)' }
if (-not (Get-Command npm  -ErrorAction SilentlyContinue)) { Write-Die 'npm não encontrado' }
if (-not (Test-Path $ServerDir)) { Write-Die "Pasta server\ não encontrada em $RepoRoot" }

# --- 2. server\.env ---
function New-JwtSecret {
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}

# Defaults do banco — único lugar com a credencial dev. .env (gitignored) é fonte da verdade.
$pgUser = 'eb'
$pgPass = 'eb'
$pgDb   = 'eb_insights'

# Chaves obrigatórias (docker-compose e/ou backend exigem).
# Se alguma estiver ausente no .env, o script acrescenta no final com um default seguro.
$requiredDefaults = [ordered]@{
  'POSTGRES_USER'     = $pgUser
  'POSTGRES_PASSWORD' = $pgPass
  'POSTGRES_DB'       = $pgDb
  'DATABASE_URL'      = ('{0}://{1}:{2}@db:5432/{3}' -f 'postgresql', $pgUser, $pgPass, $pgDb)
  'JWT_SECRET'        = $null   # gerado sob demanda
  'CORS_ORIGIN'       = 'http://localhost:8081,http://localhost:8082'
  'LOG_LEVEL'         = 'info'
  'PORT'              = '3000'
}

if (-not (Test-Path $EnvFile)) {
  Write-Log "Gerando $EnvFile (primeira execução)..."
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  $lines = @("# Gerado por dev-up.ps1 em $stamp")
  foreach ($key in $requiredDefaults.Keys) {
    $val = $requiredDefaults[$key]
    if ($key -eq 'JWT_SECRET') { $val = New-JwtSecret }
    $lines += "$key=$val"
  }
  Set-Content -Path $EnvFile -Value $lines -Encoding utf8NoBOM
  Write-Log '.env criado (JWT_SECRET aleatório). Não commite.'
} else {
  # Merge — acrescenta apenas as chaves ausentes, preservando o resto do arquivo.
  $existing = Get-Content $EnvFile
  $existingKeys = $existing | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') { $Matches[1] }
  }
  $missing = @()
  foreach ($key in $requiredDefaults.Keys) {
    if ($existingKeys -notcontains $key) { $missing += $key }
  }
  if ($missing.Count -eq 0) {
    Write-Info "$EnvFile já tem todas as chaves obrigatórias, preservando."
  } else {
    Write-Warn "$EnvFile está incompleto — acrescentando: $($missing -join ', ')"
    $append = @('', "# Acrescentado por dev-up.ps1 em $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))")
    foreach ($key in $missing) {
      $val = $requiredDefaults[$key]
      if ($key -eq 'JWT_SECRET') { $val = New-JwtSecret }
      $append += "$key=$val"
    }
    Add-Content -Path $EnvFile -Value $append -Encoding utf8NoBOM
  }
}

# --- 3. Sobe a stack (db + server) ---
$composeArgs = @('compose','up','-d')
if ($Rebuild) {
  Write-Log 'Rebuild do container server forçado (-Rebuild).'
  $composeArgs += @('--build','--force-recreate')
}
Write-Log "Subindo stack Docker: docker $($composeArgs -join ' ')..."
Push-Location $ServerDir
try {
  & docker @composeArgs
  if ($LASTEXITCODE -ne 0) { Write-Die 'docker compose up falhou' }
} finally {
  Pop-Location
}

# --- 4. Health check do backend ---
Write-Log 'Aguardando backend em http://localhost:3000/health (até 60s, mais longo na primeira subida)...'
$ok = $false
for ($i = 1; $i -le 60; $i++) {
  try {
    $resp = Invoke-RestMethod -Uri 'http://localhost:3000/health' -TimeoutSec 2 -ErrorAction Stop
    if ($resp.status -eq 'ok') { $ok = $true; break }
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $ok) {
  Write-Die 'Backend não respondeu em 60s — veja os logs com: cd server ; docker compose logs server'
}
Write-Log 'Backend respondendo.'

# --- 5. Resumo + Expo ---
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  Stack local no ar'                      -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''

@'
Endpoints:
  Backend  : http://localhost:3000
  Health   : http://localhost:3000/health
  Postgres : localhost:5432  (user: eb / pass: eb / db: eb_insights)

Comandos úteis:
  .\dev-up.ps1 -Status          # health + containers
  .\dev-up.ps1 -Down            # derruba a stack (mantém dados)
  .\dev-up.ps1 -Nuke            # derruba e apaga o volume (destrutivo)
  .\dev-up.ps1 -Rebuild         # rebuild do server após mudança de código
  cd server ; docker compose logs -f server   # ver logs do backend
  cd server ; npx prisma studio               # inspecionar o banco

Teste rápido:
  Invoke-RestMethod http://localhost:3000/health
  # Registra primeiro usuário (vira COORDINATOR) — leitura segura via Read-Host:
  $secure = Read-Host 'Senha do COORDINATOR' -AsSecureString
  $cred = [System.Net.NetworkCredential]::new('', $secure).Password
  $body = @{ email='you@example.com'; password=$cred; display_name='You' } | ConvertTo-Json
  Invoke-RestMethod -Uri http://localhost:3000/auth/register -Method POST -ContentType 'application/json' -Body $body

Celular físico (Expo Go):
  1. ipconfig    -> anote o IPv4 da LAN (ex: 192.168.0.42)
  2. Em server\.env, acrescente o IP em CORS_ORIGIN (ex: http://192.168.0.42:8081) e rode -Rebuild
  3. Antes do npm start:  $env:EXPO_PUBLIC_API_URL = 'http://192.168.0.42:3000'
'@ | Write-Host

if ($NoExpo) {
  Write-Host ''
  Write-Info 'Modo -NoExpo: infra no ar, Expo não iniciado. Rode `npm start` quando quiser.'
  return
}

# --- Resolve IP LAN pro Expo Go (se user não passou -LanIp, tenta autodetectar) ---
if (-not $LanIp) {
  try {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object {
      $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and
      $_.InterfaceAlias -notmatch '(Loopback|vEthernet|VMware|VirtualBox|WSL|Hyper-V|Docker|bridge)'
    }
    if ($candidates.Count -eq 1) {
      $LanIp = $candidates[0].IPAddress
      Write-Info "IP LAN autodetectado: $LanIp (interface: $($candidates[0].InterfaceAlias))"
    } elseif ($candidates.Count -gt 1) {
      Write-Warn 'Múltiplos IPs LAN detectados — passe -LanIp <ip> para escolher um:'
      $candidates | Format-Table IPAddress,InterfaceAlias -AutoSize | Out-String | Write-Host
      Write-Info 'Seguindo com localhost (Expo Go em celular NÃO vai funcionar até especificar o IP).'
    } else {
      Write-Info 'Nenhum IP LAN detectado — Expo Go em celular não funcionará. OK para Expo Web.'
    }
  } catch {
    Write-Info 'Autodetect de IP LAN falhou, seguindo com localhost.'
  }
}

Write-Host ''
Write-Host '─ Iniciando Expo neste terminal. Ctrl+C para encerrar.' -ForegroundColor Cyan
Write-Host '  A infra Docker continua no ar após Ctrl+C — use .\dev-up.ps1 -Down para derrubar.' -ForegroundColor Cyan
if ($LanIp) {
  Write-Host "  Backend exposto pro app em: http://${LanIp}:3000  (Expo Go vai usar esse)" -ForegroundColor Cyan
}
Write-Host ''

# EXPO_OFFLINE=1 pula o check online de versões de native modules do @expo/cli
# (contorna o bug "Body is unusable: Body has already been read" em undici/node 22).
# Não afeta o dev server nem o bundler.
$prevOffline = $env:EXPO_OFFLINE
$prevApiUrl  = $env:EXPO_PUBLIC_API_URL
$prevRnHost  = $env:REACT_NATIVE_PACKAGER_HOSTNAME
$env:EXPO_OFFLINE = '1'
if ($LanIp) {
  $env:EXPO_PUBLIC_API_URL = "http://${LanIp}:3000"
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $LanIp
}
try {
  npm start
} finally {
  if ($null -ne $prevOffline) { $env:EXPO_OFFLINE = $prevOffline }
  else { Remove-Item Env:EXPO_OFFLINE -ErrorAction SilentlyContinue }
  if ($null -ne $prevApiUrl) { $env:EXPO_PUBLIC_API_URL = $prevApiUrl }
  else { Remove-Item Env:EXPO_PUBLIC_API_URL -ErrorAction SilentlyContinue }
  if ($null -ne $prevRnHost) { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $prevRnHost }
  else { Remove-Item Env:REACT_NATIVE_PACKAGER_HOSTNAME -ErrorAction SilentlyContinue }
}
