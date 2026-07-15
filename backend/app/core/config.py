import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
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
# URL pública deste backend enviada como notification_url em cada pagamento:
# https://SEU-BACKEND/api/pagamento/webhook/mercadopago
MERCADO_PAGO_WEBHOOK_URL: str = os.getenv("MERCADO_PAGO_WEBHOOK_URL", "")
MERCADO_PAGO_MAX_PARCELAS: int = int(os.getenv("MERCADO_PAGO_MAX_PARCELAS", "12"))
MERCADO_PAGO_ENABLED: bool = bool(MERCADO_PAGO_ACCESS_TOKEN)
ADMIN_EMAILS: set[str] = {
    email.strip().lower() for email in os.getenv("ADMIN_EMAILS", "").split(",") if email.strip()
}

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
