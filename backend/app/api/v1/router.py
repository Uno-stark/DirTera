from fastapi import APIRouter

from app.api.v1 import (
    admin,
    analytics,
    auth,
    categories,
    notifications,
    payments,
    reviews,
    users,
    websites,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(categories.router)   # GET/POST/PATCH/DELETE /categories + /domains
api_router.include_router(websites.router)
api_router.include_router(analytics.router)
api_router.include_router(payments.router)
api_router.include_router(notifications.router)
api_router.include_router(reviews.router)
api_router.include_router(admin.router)
