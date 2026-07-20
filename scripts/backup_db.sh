#!/usr/bin/env bash
# Backup do banco de produção (Supabase Postgres) via session pooler.
#
# Uso:  scripts/backup_db.sh
#   - Lê SUPABASE_DB_URL do ambiente ou do backend/.env (connection string do
#     session pooler: Dashboard > Connect > Session pooler).
#   - Gera backups/viapiana_AAAA-MM-DD_HHMMSS.dump[.gpg|.age] (formato custom
#     do pg_dump) com os schemas public (catálogo, pedidos, pagamentos,
#     auditoria) e auth (contas de usuário).
#   - Mantém os BACKUP_MANTER dumps mais recentes (default 14) e apaga o resto.
#
# CRIPTOGRAFIA EM REPOUSO (LGPD — o dump tem nome, telefone, endereço, CPF/CNPJ
# em claro). O pg_dump é transmitido direto para o cifrador; o dump em claro
# NUNCA é escrito em disco. Configure UM dos métodos (ordem de preferência):
#   - age (chave pública, sem segredo na máquina de backup):
#       BACKUP_AGE_RECIPIENT=age1...     → arquivo .dump.age
#       Restaurar: age -d -i chave.txt arquivo.dump.age | pg_restore ...
#   - gpg com chave pública:
#       BACKUP_GPG_RECIPIENT=email-ou-keyid  → arquivo .dump.gpg
#       Restaurar: gpg -d arquivo.dump.gpg | pg_restore ...
#   - gpg simétrico (senha):
#       BACKUP_GPG_PASSPHRASE=...            → arquivo .dump.gpg
#       Restaurar: gpg -d arquivo.dump.gpg | pg_restore ...
# Sem nenhum configurado, o dump sai em CLARO (.dump) e o script emite um aviso.
#
# Restauração (projeto Supabase novo ou banco de teste), descriptografando na
# hora (não deixe o .dump em claro em disco):
#   gpg -d viapiana_....dump.gpg | pg_restore --no-owner --schema=public -d "$SUPABASE_DB_URL"
#   age -d -i chave.txt viapiana_....dump.age | pg_restore --no-owner --schema=public -d "$SUPABASE_DB_URL"
#   (dump em claro: pg_restore --no-owner --schema=public -d "$SUPABASE_DB_URL" arquivo.dump)
#   (o schema auth restaura melhor pela própria Supabase; o dump serve como
#   cópia de segurança dos e-mails/contas)
#
# Agendamento diário sem crontab (systemd user timer):
#   ~/.config/systemd/user/viapiana-backup.service
#     [Service]
#     Type=oneshot
#     ExecStart=%h/projeto/Ecommerce/scripts/backup_db.sh
#   ~/.config/systemd/user/viapiana-backup.timer
#     [Timer]
#     OnCalendar=daily
#     Persistent=true
#     [Install]
#     WantedBy=timers.target
#   systemctl --user enable --now viapiana-backup.timer

set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DIR_BACKUPS="${BACKUP_DIR:-$RAIZ/backups}"
MANTER="${BACKUP_MANTER:-14}"

if [[ -z "${SUPABASE_DB_URL:-}" && -f "$RAIZ/backend/.env" ]]; then
  SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' "$RAIZ/backend/.env" | tail -1 | cut -d= -f2- || true)"
fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERRO: SUPABASE_DB_URL não definida (ambiente ou backend/.env)." >&2
  echo "Formato: postgresql://postgres.PROJETO:SENHA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres" >&2
  exit 1
fi

# ── Escolhe o método de criptografia conforme o que estiver configurado ──────
METODO="nenhum"
EXT="dump"
if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  command -v age >/dev/null || { echo "ERRO: BACKUP_AGE_RECIPIENT setado mas 'age' não está instalado." >&2; exit 1; }
  METODO="age"; EXT="dump.age"
elif [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  command -v gpg >/dev/null || { echo "ERRO: BACKUP_GPG_RECIPIENT setado mas 'gpg' não está instalado." >&2; exit 1; }
  METODO="gpg-key"; EXT="dump.gpg"
elif [[ -n "${BACKUP_GPG_PASSPHRASE:-}" ]]; then
  command -v gpg >/dev/null || { echo "ERRO: BACKUP_GPG_PASSPHRASE setado mas 'gpg' não está instalado." >&2; exit 1; }
  METODO="gpg-pass"; EXT="dump.gpg"
else
  echo "AVISO: nenhuma chave/senha de criptografia configurada — o backup sai em CLARO." >&2
  echo "       Contém dados pessoais (LGPD). Configure BACKUP_AGE_RECIPIENT," >&2
  echo "       BACKUP_GPG_RECIPIENT ou BACKUP_GPG_PASSPHRASE. Ver cabeçalho do script." >&2
fi

# Lê o dump em claro da stdin e grava cifrado (ou em claro) em $1. A senha do
# gpg vai por fd 3 (here-string), nunca em argv (visível no ps).
encriptar() {
  case "$METODO" in
    age)      age -r "$BACKUP_AGE_RECIPIENT" -o "$1" ;;
    gpg-key)  gpg --batch --yes --trust-model always --encrypt \
                --recipient "$BACKUP_GPG_RECIPIENT" -o "$1" ;;
    gpg-pass) gpg --batch --yes --symmetric --cipher-algo AES256 \
                --pinentry-mode loopback --passphrase-fd 3 -o "$1" \
                3<<<"$BACKUP_GPG_PASSPHRASE" ;;
    nenhum)   cat > "$1" ;;
  esac
}

mkdir -p "$DIR_BACKUPS"
ARQUIVO="$DIR_BACKUPS/viapiana_$(date +%Y-%m-%d_%H%M%S).$EXT"

# pg_dump para stdout (-Fc, sem -f) → cifrador → arquivo. pipefail garante que
# uma falha do pg_dump derruba a pipeline (não gera arquivo cifrado inválido).
# --no-owner/--no-privileges: papéis do Supabase não existem fora de lá.
if ! pg_dump "$SUPABASE_DB_URL" -Fc --no-owner --no-privileges \
    --schema=public --schema=auth | encriptar "$ARQUIVO"; then
  # Sem permissão de leitura no schema auth (varia por projeto/papel):
  # ainda vale salvar os dados da loja.
  echo "AVISO: dump de public+auth falhou; tentando somente public…" >&2
  rm -f "$ARQUIVO"
  pg_dump "$SUPABASE_DB_URL" -Fc --no-owner --no-privileges \
    --schema=public | encriptar "$ARQUIVO"
fi

echo "Backup criado: $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1)) [cripto: $METODO]"

# Rotação: cobre .dump, .dump.gpg e .dump.age (glob viapiana_*.dump*)
ANTIGOS="$(ls -1t "$DIR_BACKUPS"/viapiana_*.dump* 2>/dev/null | tail -n +"$((MANTER + 1))" || true)"
if [[ -n "$ANTIGOS" ]]; then
  echo "Removendo dumps antigos (mantendo os $MANTER mais recentes):"
  echo "$ANTIGOS" | while read -r antigo; do
    echo "  - $(basename "$antigo")"
    rm -- "$antigo"
  done
fi
