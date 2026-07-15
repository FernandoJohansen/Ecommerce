from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, cart, categories, frete, orders, payments, products, users
from app.core.config import ALLOWED_ORIGINS

app = FastAPI(title="Carolina Viapiana API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

api_router = APIRouter(prefix="/api")
api_router.include_router(products.router)
api_router.include_router(orders.router)
api_router.include_router(categories.router)
api_router.include_router(auth.router)
api_router.include_router(cart.router)
api_router.include_router(payments.router)
api_router.include_router(users.router)
api_router.include_router(frete.router)

app.include_router(api_router)


@app.get("/")
def health():
    return {"status": "ok"}
