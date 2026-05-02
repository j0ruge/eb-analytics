#!/usr/bin/env bash
# EB Insights — sobe a stack completa (Postgres + backend em Docker + Expo) num terminal só.
#
# What it does (in order):
#   1. Verifies prereqs: docker daemon, node, npm, curl
#   2. Creates/merges server/.env with the required keys (generates JWT_SECRET)
#   3. Starts db + server via docker compose (server container runs migrations on boot)
#   4. Waits for http://localhost:3000/health
#   5. Starts Expo in foreground in the same terminal (unless --no-expo)
#
# Usage:
#   ./dev-up.sh                        # sobe tudo e inicia Expo (autodetecta IP LAN)
#   ./dev-up.sh --lan-ip 192.168.0.42  # força um IP específico pro Expo Go
#   ./dev-up.sh --no-expo              # só infra, não inicia Expo
#   ./dev-up.sh --rebuild              # força rebuild do container do server
#   ./dev-up.sh --down                 # derruba a stack (preserva o volume)
#   ./dev-up.sh --nuke                 # derruba e apaga o volume (destrutivo)
#   ./dev-up.sh --status               # health + containers

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; RESET='\033[0m'
log()  { printf "${GREEN}[dev-up]${RESET} %s\n" "$*"; }
info() { printf "${CYAN}[dev-up]${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}[dev-up]${RESET} %s\n" "$*"; }
die()  { printf "${RED}[dev-up]${RESET} %s\n" "$*" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$REPO_ROOT/server"
ENV_FILE="$SERVER_DIR/.env"

cmd_down() {
  info "Parando Postgres (volume preservado)..."
  (cd "$SERVER_DIR" && docker compose down)
  log "Stack parada. Rode ./dev-up.sh novamente quando quiser subir."
}

cmd_nuke() {
  warn "Parando Postgres E apagando volume de dados. Isso é DESTRUTIVO."
  read -r -p "Digite 'sim' para confirmar: " answer
  [[ "$answer" == "sim" ]] || die "Abortado."
  (cd "$SERVER_DIR" && docker compose down -v)
  log "Volume pg_data removido."
}

cmd_status() {
  info "Containers (docker compose ps):"
  (cd "$SERVER_DIR" && docker compose ps) || true
  echo
  info "Health endpoint:"
  if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    curl -s http://localhost:3000/health; echo
  else
    warn "Backend não está respondendo em http://localhost:3000/health"
  fi
}

# --- Subcommands + flag parsing ---
NO_EXPO=0
REBUILD=0
LAN_IP=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --down)     cmd_down;   exit 0 ;;
    --nuke)     cmd_nuke;   exit 0 ;;
    --status)   cmd_status; exit 0 ;;
    --no-expo)  NO_EXPO=1; shift ;;
    --rebuild)  REBUILD=1; shift ;;
    --lan-ip)   LAN_IP="${2:-}"; shift 2 ;;
    --help|-h)  sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "Flag desconhecida: $1 (tente --help)" ;;
  esac
done

# --- 1. Prereqs ---
log "Verificando pré-requisitos..."
command -v docker >/dev/null 2>&1 || die "Docker não encontrado no PATH (instale Docker Desktop)"
docker info >/dev/null 2>&1        || die "Docker daemon não está rodando (abra o Docker Desktop)"
docker compose version >/dev/null 2>&1 || die "'docker compose' (plugin v2) não disponível"
command -v node >/dev/null 2>&1    || die "Node não encontrado (instale Node.js 22 LTS)"
command -v npm  >/dev/null 2>&1    || die "npm não encontrado"
command -v curl >/dev/null 2>&1    || die "curl não encontrado"
[[ -d "$SERVER_DIR" ]] || die "Pasta server/ não encontrada em $REPO_ROOT"

# --- 2. server/.env ---
gen_jwt() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48
  else
    node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
  fi
}

# Defaults do banco — único lugar com a credencial dev. .env (gitignored) é fonte da verdade.
DEFAULT_PG_USER='eb'
DEFAULT_PG_PASS='eb'
DEFAULT_PG_DB='eb_insights'

# Chaves obrigatórias (docker-compose e/ou backend exigem).
REQUIRED_KEYS=(POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL JWT_SECRET CORS_ORIGIN LOG_LEVEL PORT)
default_for() {
  case "$1" in
    POSTGRES_USER)     echo "$DEFAULT_PG_USER" ;;
    POSTGRES_PASSWORD) echo "$DEFAULT_PG_PASS" ;;
    POSTGRES_DB)       echo "$DEFAULT_PG_DB" ;;
    DATABASE_URL)      printf '%s://%s:%s@db:5432/%s' postgresql "$DEFAULT_PG_USER" "$DEFAULT_PG_PASS" "$DEFAULT_PG_DB" ;;
    JWT_SECRET)        gen_jwt ;;
    CORS_ORIGIN)       echo "http://localhost:8081,http://localhost:8082" ;;
    LOG_LEVEL)         echo "info" ;;
    PORT)              echo "3000" ;;
  esac
}

if [[ ! -f "$ENV_FILE" ]]; then
  log "Gerando $ENV_FILE (primeira execução)..."
  {
    echo "# Gerado por dev-up.sh em $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    for key in "${REQUIRED_KEYS[@]}"; do
      echo "$key=$(default_for "$key")"
    done
  } > "$ENV_FILE"
  log ".env criado (JWT_SECRET aleatório). Não commite."
else
  # Merge — acrescenta apenas as chaves ausentes, preservando o resto do arquivo.
  missing=()
  for key in "${REQUIRED_KEYS[@]}"; do
    if ! grep -qE "^[[:space:]]*${key}=" "$ENV_FILE"; then
      missing+=("$key")
    fi
  done
  if [[ ${#missing[@]} -eq 0 ]]; then
    info "$ENV_FILE já tem todas as chaves obrigatórias, preservando."
  else
    warn "$ENV_FILE está incompleto — acrescentando: ${missing[*]}"
    {
      echo ""
      echo "# Acrescentado por dev-up.sh em $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
      for key in "${missing[@]}"; do
        echo "$key=$(default_for "$key")"
      done
    } >> "$ENV_FILE"
  fi
fi

# --- 3. Sobe a stack (db + server) ---
compose_args=(compose up -d)
if [[ $REBUILD -eq 1 ]]; then
  log "Rebuild do container server forçado (--rebuild)."
  compose_args+=(--build --force-recreate)
fi
log "Subindo stack Docker: docker ${compose_args[*]}..."
(cd "$SERVER_DIR" && docker "${compose_args[@]}") || die "docker compose up falhou"

# --- 4. Health check do backend ---
log "Aguardando backend em http://localhost:3000/health (até 60s, mais longo na primeira subida)..."
ok=0
for i in {1..60}; do
  if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    ok=1; break
  fi
  sleep 1
done
[[ $ok -eq 1 ]] || die "Backend não respondeu em 60s — veja: cd server && docker compose logs server"
log "Backend respondendo."

# --- 5. Resumo + Expo ---
printf "\n${GREEN}========================================${RESET}\n"
printf "${GREEN}  Stack local no ar${RESET}\n"
printf "${GREEN}========================================${RESET}\n\n"

cat <<'SUMMARY'
Endpoints:
  Backend  : http://localhost:3000
  Health   : http://localhost:3000/health
  Postgres : localhost:5432  (user: eb / pass: eb / db: eb_insights)

Comandos úteis:
  ./dev-up.sh --status          # health + containers
  ./dev-up.sh --down            # derruba a stack (mantém dados)
  ./dev-up.sh --nuke            # derruba e apaga o volume (destrutivo)
  ./dev-up.sh --rebuild         # rebuild do server após mudança de código
  cd server && docker compose logs -f server   # ver logs do backend
  cd server && npx prisma studio               # inspecionar o banco

Teste rápido:
  curl http://localhost:3000/health
  # Registra primeiro usuário (vira COORDINATOR)
  curl -s -X POST http://localhost:3000/auth/register \
    -H 'Content-Type: application/json' \
    -d '{"email":"you@example.com","password":"troque-isso","display_name":"You"}'

Celular físico (Expo Go):
  1. Descubra o IP da máquina na LAN (ipconfig / ifconfig).
  2. Acrescente o IP em CORS_ORIGIN no server/.env e rode --rebuild.
  3. Antes de `npm start`, exporte: EXPO_PUBLIC_API_URL=http://<IP>:3000
SUMMARY

if [[ $NO_EXPO -eq 1 ]]; then
  echo
  info "Modo --no-expo: infra no ar, Expo não iniciado. Rode 'npm start' quando quiser."
  exit 0
fi

# --- Resolve IP LAN pro Expo Go (se user não passou --lan-ip, tenta autodetectar) ---
if [[ -z "$LAN_IP" ]]; then
  # Ordem de tentativas: Linux (ip route), macOS (ipconfig), fallback (hostname -I).
  if command -v ip >/dev/null 2>&1; then
    LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i=1;i<=NF;i++) if ($i=="src") print $(i+1)}' | head -1 || true)
  fi
  if [[ -z "$LAN_IP" ]] && command -v ipconfig >/dev/null 2>&1; then
    LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
  fi
  if [[ -z "$LAN_IP" ]] && command -v hostname >/dev/null 2>&1; then
    LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
  fi
  if [[ -n "$LAN_IP" && "$LAN_IP" != 127.* && "$LAN_IP" != 169.254.* ]]; then
    info "IP LAN autodetectado: $LAN_IP"
  else
    LAN_IP=""
    info "Não foi possível autodetectar IP LAN — Expo Go em celular não funcionará. OK para Expo Web."
  fi
fi

echo
printf "${CYAN}─ Iniciando Expo neste terminal. Ctrl+C para encerrar.${RESET}\n"
printf "${CYAN}  A infra Docker continua no ar após Ctrl+C — use ./dev-up.sh --down para derrubar.${RESET}\n"
if [[ -n "$LAN_IP" ]]; then
  printf "${CYAN}  Backend exposto pro app em: http://%s:3000  (Expo Go vai usar esse)${RESET}\n" "$LAN_IP"
fi
echo

# EXPO_OFFLINE=1 pula o check online de versões de native modules do @expo/cli
# (contorna o bug "Body is unusable: Body has already been read" em undici/node 22).
# Se LAN_IP resolvido, aponta o app pro backend do PC e força Metro a anunciar esse hostname.
if [[ -n "$LAN_IP" ]]; then
  exec env \
    EXPO_OFFLINE=1 \
    EXPO_PUBLIC_API_URL="http://${LAN_IP}:3000" \
    REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP" \
    npm start
else
  exec env EXPO_OFFLINE=1 npm start
fi
