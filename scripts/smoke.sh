#!/usr/bin/env bash
# Smoke test pós-deploy da API (Render) e, opcionalmente, do site (Cloudflare).
#
# Uso:  scripts/smoke.sh <API_URL> [SITE_URL]
#   API_URL   ex.: https://viapiana-api.onrender.com
#   SITE_URL  ex.: https://loja.example.com (opcional)
#
# Variáveis de ambiente (opcionais):
#   CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET
#     Service token do Cloudflare Access; enviado ao SITE_URL apenas se ambas
#     estiverem definidas. Nunca é impresso.
#
# Verificações: /, /health/db, /api/produtos, headers de segurança da API,
# CORS (nega origem desconhecida, permite a origem do site) e headers do site
# (ou portão do Cloudflare Access).
#
# Saída: 0 se tudo OK, 1 se houve falhas, 2 em uso incorreto.
# Fases futuras devem reexecutar este script após cada deploy.

set -euo pipefail

usage() {
  echo "Uso: scripts/smoke.sh <API_URL> [SITE_URL]"
}

if [ "$#" -lt 1 ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 2
fi

API="${1%/}"
SITE=""
if [ "$#" -ge 2 ] && [ -n "$2" ]; then
  SITE="${2%/}"
fi

FALHAS=0

ok() { echo "OK: $1"; }
fail() {
  echo "FAIL: $1"
  FALHAS=$((FALHAS + 1))
}

# Em caso de erro do curl devolve vazio (set -e não derruba o script).
fetch() { curl -fsS "$@" 2>/dev/null || true; }
headers() { curl -sI "$@" 2>/dev/null | tr -d '\r' || true; }

# 1. Raiz da API (90 s tolera cold start do Render Free)
body="$(fetch --max-time 90 "$API/")"
if printf '%s' "$body" | grep -q '"status":[[:space:]]*"ok"'; then
  ok "GET / responde status ok"
else
  fail "GET / não respondeu status ok"
fi

# 2. Health do banco (na raiz, não em /api)
body="$(fetch --max-time 30 "$API/health/db")"
if printf '%s' "$body" | grep -q '"status":[[:space:]]*"ok"'; then
  ok "GET /health/db responde status ok"
else
  fail "GET /health/db não respondeu status ok"
fi

# 3. Catálogo
body="$(fetch --max-time 30 "$API/api/produtos")"
trimmed="$(printf '%s' "$body" | tr -d '[:space:]')"
if [ "${trimmed:0:1}" = "[" ] && [ "$trimmed" != "[]" ]; then
  ok "GET /api/produtos retorna lista não vazia"
else
  fail "GET /api/produtos não retornou lista não vazia"
fi

# 4. Headers de segurança da API
h="$(headers --max-time 30 "$API/")"
if printf '%s\n' "$h" | grep -qi '^x-content-type-options:'; then
  ok "API envia x-content-type-options"
else
  fail "API sem x-content-type-options"
fi
if printf '%s\n' "$h" | grep -qi '^strict-transport-security:'; then
  ok "API envia strict-transport-security"
else
  fail "API sem strict-transport-security"
fi

# 5. CORS: origem desconhecida não pode ser permitida
h="$(headers --max-time 30 -H "Origin: https://evil.example" "$API/api/produtos")"
if printf '%s\n' "$h" | grep -qi '^access-control-allow-origin:'; then
  fail "CORS permite origem desconhecida"
else
  ok "CORS nega origem desconhecida"
fi

if [ -n "$SITE" ]; then
  ORIGIN="$(printf '%s' "$SITE" | sed -E 's#^(https?://[^/]+).*#\1#')"

  # 6. CORS: origem do site permitida
  h="$(headers --max-time 30 -H "Origin: $ORIGIN" "$API/api/produtos")"
  if printf '%s\n' "$h" | grep -qi "^access-control-allow-origin: *$ORIGIN\$"; then
    ok "CORS permite a origem do site ($ORIGIN)"
  else
    fail "CORS não permite a origem do site ($ORIGIN)"
  fi

  # 7. Headers do site ou portão do Cloudflare Access
  extra=()
  if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
    extra=(-H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET")
  fi
  h="$(headers --max-time 30 "${extra[@]+"${extra[@]}"}" "$SITE/")"
  status="$(printf '%s\n' "$h" | head -n1 | awk '{print $2}')"
  location="$(printf '%s\n' "$h" | grep -i '^location:' | head -n1 || true)"
  if { [ "$status" = "302" ] || [ "$status" = "303" ]; } && printf '%s' "$location" | grep -qi 'cloudflareaccess.com'; then
    ok "site protegido pelo Cloudflare Access (headers do site não verificáveis sem service token)"
  else
    csp="$(printf '%s\n' "$h" | grep -i '^content-security-policy:' | head -n1 || true)"
    if [ -n "$csp" ]; then
      ok "site envia content-security-policy"
    else
      fail "site sem content-security-policy"
    fi
    if printf '%s\n' "$h" | grep -qi '^x-content-type-options:'; then
      ok "site envia x-content-type-options"
    else
      fail "site sem x-content-type-options"
    fi
    connect="$(printf '%s' "$csp" | grep -oi 'connect-src[^;]*' || true)"
    if printf '%s' "$connect" | grep -qF "$API"; then
      ok "CSP connect-src contém a origem da API"
    else
      fail "CSP connect-src não contém a origem da API"
    fi
  fi
fi

if [ "$FALHAS" -eq 0 ]; then
  echo "smoke OK"
  exit 0
fi
echo "smoke FALHOU ($FALHAS falhas)"
exit 1
