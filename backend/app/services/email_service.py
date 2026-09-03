"""E-mail transacional via Brevo REST API.

Desligado automaticamente quando BREVO_API_KEY ou EMAIL_FROM não estão
configurados — todos os `enviar_*` retornam imediatamente sem efeito.
Cada envio dispara numa thread-daemon para não bloquear o request.
"""

import html
import logging
import threading

import httpx

from app.core.config import BREVO_API_KEY, BREVO_ENABLED, EMAIL_FROM, EMAIL_FROM_NAME, FRONTEND_URL

logger = logging.getLogger(__name__)

_BREVO_URL = "https://api.brevo.com/v3/smtp/email"

_http_client = httpx.Client(
    headers={"api-key": BREVO_API_KEY or "", "Content-Type": "application/json"},
    timeout=10,
)


def close_client() -> None:
    _http_client.close()


def _post(payload: dict) -> None:
    if not BREVO_ENABLED:
        return
    try:
        resp = _http_client.post(_BREVO_URL, json=payload)
        if resp.status_code not in (200, 201):
            logger.warning("brevo error %s: %s", resp.status_code, resp.text[:300])
        else:
            to = (payload.get("to") or [{}])[0].get("email", "?")
            logger.info("email.sent to=%s subject=%r", to, payload.get("subject"))
    except Exception:
        logger.exception("email.failed subject=%r", payload.get("subject"))


def _fire(payload: dict) -> None:
    threading.Thread(target=_post, args=(payload,), daemon=True).start()


def _sender() -> dict:
    return {"name": EMAIL_FROM_NAME, "email": EMAIL_FROM}


def _brl(centavos: int) -> str:
    return f"R$ {centavos // 100:,}".replace(",", ".") + f",{centavos % 100:02d}"


def _rastreio_url(pedido_id: str) -> str:
    return f"{FRONTEND_URL}/rastreio/{pedido_id}"


def _base_html(titulo: str, corpo: str, pedido_id: str) -> str:
    url = _rastreio_url(pedido_id)
    return f"""
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#111;padding:24px">
  <p style="font-size:.75em;letter-spacing:.15em;text-transform:uppercase;color:#888;margin:0 0 24px">
    Carolina Viapiana
  </p>
  <h2 style="margin:0 0 16px;letter-spacing:.04em;font-weight:normal">{titulo}</h2>
  {corpo}
  <p style="margin:24px 0 0">
    <a href="{url}" style="color:#111;text-decoration:underline">Acompanhar pedido →</a>
  </p>
  <p style="margin:32px 0 0;font-size:.8em;color:#999">
    Difusores e aromas artesanais · Ponta Grossa-PR
  </p>
</div>"""


def enviar_pedido_criado(pedido: dict) -> None:
    email = pedido.get("email_cliente")
    if not email:
        return
    nome = html.escape(pedido.get("nome_cliente") or "Cliente")
    pid = pedido["id"]
    itens = pedido.get("itens") or []
    total = pedido.get("total_centavos", 0)

    linhas = "".join(
        f"<tr>"
        f"<td style='padding:6px 0;border-bottom:1px solid #eee'>"
        f"{html.escape(it['produto_nome'])} {html.escape(it['tamanho'])} — {html.escape(it['aroma'])}"
        f"{'&nbsp;<em>(refil)</em>' if it.get('refil') else ''}"
        f" × {it['quantidade']}</td>"
        f"<td style='padding:6px 0;border-bottom:1px solid #eee;text-align:right'>"
        f"{_brl(it['subtotal_centavos'])}</td>"
        f"</tr>"
        for it in itens
    )
    corpo = f"""
<p style="margin:0 0 16px">Olá, {nome}. Recebemos seu pedido e já estamos separando tudo.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 16px">
  {linhas}
  <tr>
    <td style="padding:10px 0;font-weight:bold">Total</td>
    <td style="padding:10px 0;text-align:right;font-weight:bold">{_brl(total)}</td>
  </tr>
</table>
<p style="margin:0;color:#555;font-size:.9em">
  Assim que o pagamento for confirmado, você receberá outro e-mail.
</p>"""

    _fire({
        "sender": _sender(),
        "to": [{"email": email, "name": nome}],
        "subject": f"Pedido recebido — #{pid[:8].upper()}",
        "htmlContent": _base_html("Pedido recebido", corpo, pid),
    })


def enviar_pagamento_confirmado(pedido: dict) -> None:
    email = pedido.get("email_cliente")
    if not email:
        return
    nome = html.escape(pedido.get("nome_cliente") or "Cliente")
    pid = pedido["id"]
    total = pedido.get("total_centavos", 0)

    corpo = f"""
<p style="margin:0 0 16px">
  Olá, {nome}. Seu pagamento de <strong>{_brl(total)}</strong> foi confirmado.
</p>
<p style="margin:0;color:#555;font-size:.9em">
  Agora é só aguardar — prepararemos seu pedido com todo cuidado e
  avisaremos quando sair para entrega.
</p>"""

    _fire({
        "sender": _sender(),
        "to": [{"email": email, "name": nome}],
        "subject": f"Pagamento confirmado — #{pid[:8].upper()}",
        "htmlContent": _base_html("Pagamento confirmado", corpo, pid),
    })


def enviar_pedido_enviado(pedido: dict) -> None:
    email = pedido.get("email_cliente")
    if not email:
        return
    nome = html.escape(pedido.get("nome_cliente") or "Cliente")
    pid = pedido["id"]
    codigo = pedido.get("codigo_rastreio")
    servico = pedido.get("frete_servico") or ""

    rastreio_html = (
        f"<p style='margin:12px 0;padding:12px;background:#f5f5f5;font-family:monospace'>"
        f"<strong>{html.escape(codigo)}</strong>"
        + (f"<br><span style='font-size:.85em;color:#666'>{html.escape(servico)}</span>" if servico else "")
        + "</p>"
        if codigo
        else ""
    )

    corpo = f"""
<p style="margin:0 0 12px">Olá, {nome}. Seu pedido saiu para entrega!</p>
{rastreio_html}
<p style="margin:0;color:#555;font-size:.9em">
  Acompanhe a entrega pelo link abaixo ou pelo site da transportadora.
</p>"""

    _fire({
        "sender": _sender(),
        "to": [{"email": email, "name": nome}],
        "subject": f"Pedido enviado — #{pid[:8].upper()}",
        "htmlContent": _base_html("Pedido enviado", corpo, pid),
    })
