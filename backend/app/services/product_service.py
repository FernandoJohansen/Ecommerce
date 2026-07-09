from app.repositories.product_repository import get_all_aromas, get_all_produtos


def list_produtos() -> list[dict]:
    return get_all_produtos()


def list_aromas() -> list[dict]:
    return get_all_aromas()
