"""
Import all models here so Alembic's env.py can auto-discover them.
"""

from app.models.user import User
from app.models.category import Category, Domain
from app.models.website import Website, WebsiteStatus
from app.models.click import ClickEvent
from app.models.subscription import Subscription, SubscriptionPlan, SubscriptionStatus
from app.models.review import Review
from app.models.notification import Notification

__all__ = [
    "User",
    "Category",
    "Domain",
    "Website",
    "WebsiteStatus",
    "ClickEvent",
    "Subscription",
    "SubscriptionPlan",
    "SubscriptionStatus",
    "Review",
    "Notification",
]
