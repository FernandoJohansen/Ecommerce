from app.repositories.category_repository import get_product_tags


def list_categorias() -> list[dict]:
    return get_product_tags()
