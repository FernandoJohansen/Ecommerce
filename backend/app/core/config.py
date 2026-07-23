import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
FRONTEND_URL: str = os.getenv("FRONTEND_URL", ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "http://localhost:5173")
PIX_KEY: str = os.getenv("PIX_KEY", "")
PIX_BENEFICIARIO: str = os.getenv("PIX_BENEFICIARIO", "Carolina Viapiana")

# API Pix Sicredi (OAuth2 client_credentials + mTLS). Sem credenciais, os
# endpoints de cobrança respondem 503 e o resto da API segue funcionando.
SICREDI_BASE_URL: str = os.getenv("SICREDI_BASE_URL", "https://api-pix.sicredi.com.br")
SICREDI_CLIENT_ID: str = os.getenv("SICREDI_CLIENT_ID", "")
SICREDI_CLIENT_SECRET: str = os.getenv("SICREDI_CLIENT_SECRET", "")
SICREDI_CERT_PATH: str = os.getenv("SICREDI_CERT_PATH", "")
SICREDI_KEY_PATH: str = os.getenv("SICREDI_KEY_PATH", "")
# Cadeia completa Sicredi (opcional; usada como CA extra na verificação TLS)
SICREDI_CA_PATH: str = os.getenv("SICREDI_CA_PATH", "")
# URL pública deste backend registrada no webhook do Sicredi; as notificações
# chegam em {PIX_WEBHOOK_URL}/pix
PIX_WEBHOOK_URL: str = os.getenv("PIX_WEBHOOK_URL", "")

SICREDI_ENABLED: bool = bool(
    SICREDI_CLIENT_ID and SICREDI_CLIENT_SECRET and SICREDI_CERT_PATH and SICREDI_KEY_PATH
)

# Mercado Pago (cartão de crédito + boleto). Sem access token, os endpoints
# de cartão/boleto respondem 503 e o PIX segue funcionando normalmente.
MERCADO_PAGO_BASE_URL: str = os.getenv("MERCADO_PAGO_BASE_URL", "https://api.mercadopago.com")
MERCADO_PAGO_ACCESS_TOKEN: str = os.getenv("MERCADO_PAGO_ACCESS_TOKEN", "")
# Assinatura secreta da tela de Webhooks do painel MP (opcional; habilita a
# validação do header x-signature)
MERCADO_PAGO_WEBHOOK_SECRET: str = os.getenv("MERCADO_PAGO_WEBHOOK_SECRET", "")
# Janela de frescor do ts assinado no x-signature (anti-replay). O ts entra no
# manifesto do HMAC, então já vem autenticado; recusar ts fora desta janela
# bloqueia o reenvio de uma notificação antiga capturada. 0 desliga a checagem.
MERCADO_PAGO_WEBHOOK_TOLERANCIA_SEGUNDOS: int = int(
    os.getenv("MERCADO_PAGO_WEBHOOK_TOLERANCIA_SEGUNDOS", "300")
)
# URL pública deste backend enviada como notification_url em cada pagamento:
# https://SEU-BACKEND/api/pagamento/webhook/mercadopago
MERCADO_PAGO_WEBHOOK_URL: str = os.getenv("MERCADO_PAGO_WEBHOOK_URL", "")
MERCADO_PAGO_MAX_PARCELAS: int = int(os.getenv("MERCADO_PAGO_MAX_PARCELAS", "12"))
MERCADO_PAGO_ENABLED: bool = bool(MERCADO_PAGO_ACCESS_TOKEN)

# Fail-closed dos webhooks: em produção, marque como true para o webhook do
# Mercado Pago RECUSAR notificações quando o secret de assinatura não estiver
# configurado (em vez de aceitar sem validar). Mantido false por padrão para
# não quebrar o setup inicial/sandbox antes de o secret ser gerado no painel.
WEBHOOK_REQUIRE_SIGNATURE: bool = os.getenv("WEBHOOK_REQUIRE_SIGNATURE", "false").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

# Melhor Envio (cálculo de frete). Sem token, POST /api/frete/cotacao responde
# 503 e o checkout segue sem frete (frete combinado pelo WhatsApp).
MELHOR_ENVIO_BASE_URL: str = os.getenv("MELHOR_ENVIO_BASE_URL", "https://melhorenvio.com.br")
MELHOR_ENVIO_TOKEN: str = os.getenv("MELHOR_ENVIO_TOKEN", "")
# E-mail de contato técnico exigido pelo Melhor Envio no header User-Agent
MELHOR_ENVIO_CONTATO: str = os.getenv("MELHOR_ENVIO_CONTATO", "")
# CEP de onde os pedidos são despachados (só dígitos) — Ponta Grossa-PR
FRETE_CEP_ORIGEM: str = os.getenv("FRETE_CEP_ORIGEM", "")
# Pedidos com subtotal de itens a partir deste valor ganham a opção mais
# barata de frete de graça (R$ 300,00)
FRETE_GRATIS_MINIMO_CENTAVOS: int = int(os.getenv("FRETE_GRATIS_MINIMO_CENTAVOS", "30000"))
# Caixa padrão usada na cotação (cm); o peso vem dos itens do pedido
FRETE_PACOTE_ALTURA_CM: int = int(os.getenv("FRETE_PACOTE_ALTURA_CM", "15"))
FRETE_PACOTE_LARGURA_CM: int = int(os.getenv("FRETE_PACOTE_LARGURA_CM", "20"))
FRETE_PACOTE_COMPRIMENTO_CM: int = int(os.getenv("FRETE_PACOTE_COMPRIMENTO_CM", "20"))
MELHOR_ENVIO_ENABLED: bool = bool(MELHOR_ENVIO_TOKEN and FRETE_CEP_ORIGEM)
# Pedido 'novo' sem pagamento aprovado é cancelado (com estoque devolvido)
# depois deste prazo. A varredura só roda com alguma integração de pagamento
# ativa — sem PSP, os pedidos são negociados manualmente e não expiram.
PEDIDO_EXPIRA_HORAS: int = int(os.getenv("PEDIDO_EXPIRA_HORAS", "24"))

# ── Token de pagamento (anti-IDOR nos endpoints públicos de pagamento) ───────
# Segredo do HMAC dos tokens devolvidos na criação do pedido. Sem valor,
# deriva do SUPABASE_KEY (rotacionar a chave do Supabase invalida os tokens
# vigentes). A validade precisa cobrir o ciclo do boleto (vence em 3 dias +
# compensação em até 3 dias úteis) — default 7 dias.
PAYMENT_TOKEN_SECRET: str = os.getenv("PAYMENT_TOKEN_SECRET", "") or SUPABASE_KEY
PAYMENT_TOKEN_TTL_SEGUNDOS: int = int(os.getenv("PAYMENT_TOKEN_TTL_SEGUNDOS", str(7 * 86400)))

# ── Rate limit: resolução do IP real do cliente ──────────────────────────────
# X-Forwarded-For é controlado pelo cliente; confiar no primeiro valor deixa o
# rate limit forjável. Configure conforme o deploy:
#   - Atrás de um CDN que injeta o IP real num header próprio e remove cópias
#     do cliente (Cloudflare: cf-connecting-ip; Akamai: true-client-ip):
#       RATE_LIMIT_CLIENT_IP_HEADER=cf-connecting-ip
#   - Atrás de N proxies reversos que só ANEXAM ao X-Forwarded-For
#     (Railway/Render normalmente = 1): RATE_LIMIT_TRUSTED_PROXY_HOPS=1
#       → usa o IP que está a N posições do fim da lista (à prova de spoof).
#   - Sem proxy / valor não configurado: usa o IP da conexão (peer), que o
#     cliente não forja. Default seguro.
RATE_LIMIT_CLIENT_IP_HEADER: str = os.getenv("RATE_LIMIT_CLIENT_IP_HEADER", "").strip().lower()
RATE_LIMIT_TRUSTED_PROXY_HOPS: int = int(os.getenv("RATE_LIMIT_TRUSTED_PROXY_HOPS", "0"))

# Docs interativas da API (/docs, /redoc, /openapi.json). Desligadas por
# padrão: em produção expõem toda a superfície da API sem autenticação. Ligar
# só em dev (ENABLE_API_DOCS=true).
ENABLE_API_DOCS: bool = os.getenv("ENABLE_API_DOCS", "false").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
