from app.core.config import PIX_BENEFICIARIO, PIX_KEY


def get_pix_info() -> dict:
    return {
        "chave": PIX_KEY,
        "beneficiario": PIX_BENEFICIARIO,
        "instrucoes": "Após o pagamento, envie o comprovante pelo WhatsApp.",
    }
