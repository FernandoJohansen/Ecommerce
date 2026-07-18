#!/usr/bin/env bash
# Backup do banco de produção (Supabase Postgres) via session pooler.
#
# Uso:  scripts/backup_db.sh
#   - Lê SUPABASE_DB_URL do ambiente ou do backend/.env (connection string do
#     session pooler: Dashboard > Connect > Session pooler).
#   - Gera backups/viapiana_AAAA-MM-DD_HHMMSS.dump (formato custom do
#     pg_dump) com os schemas public (catálogo, pedidos, pagamentos,
#     auditoria) e auth (contas de usuário).
#   - Mantém os BACKUP_MANTER dumps mais recentes (default 14) e apaga o resto.
#
# Restauração (projeto Supabase novo ou banco de teste):
#   pg_restore --no-owner --schema=public -d "$SUPABASE_DB_URL" arquivo.dump
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
#
# LGPD: o dump contém dados pessoais (nome, telefone, endereço, CPF/CNPJ em
# claro). Manter só em disco local/criptografado; nunca commitar nem subir
# para serviço de terceiros sem criptografia.

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

mkdir -p "$DIR_BACKUPS"
ARQUIVO="$DIR_BACKUPS/viapiana_$(date +%Y-%m-%d_%H%M%S).dump"

# --no-owner/--no-privileges: papéis do Supabase não existem fora de lá;
# sem essas flags a restauração em outro banco falha
if ! pg_dump "$SUPABASE_DB_URL" -Fc --no-owner --no-privileges \
    --schema=public --schema=auth -f "$ARQUIVO"; then
  # Sem permissão de leitura no schema auth (varia por projeto/papel):
  # ainda vale salvar os dados da loja
  echo "AVISO: dump de public+auth falhou; tentando somente public…" >&2
  rm -f "$ARQUIVO"
  pg_dump "$SUPABASE_DB_URL" -Fc --no-owner --no-privileges \
    --schema=public -f "$ARQUIVO"
fi

echo "Backup criado: $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))"

ANTIGOS="$(ls -1t "$DIR_BACKUPS"/viapiana_*.dump 2>/dev/null | tail -n +"$((MANTER + 1))" || true)"
if [[ -n "$ANTIGOS" ]]; then
  echo "Removendo dumps antigos (mantendo os $MANTER mais recentes):"
  echo "$ANTIGOS" | while read -r antigo; do
    echo "  - $(basename "$antigo")"
    rm -- "$antigo"
  done
fi
