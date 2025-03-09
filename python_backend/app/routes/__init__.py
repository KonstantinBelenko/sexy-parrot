"""
API routes for the application.
"""

from .image_generation import router as image_generation_router
from .interpretation import router as interpretation_router
from .jobs import router as jobs_router

__all__ = [
    "image_generation_router",
    "interpretation_router", 
    "jobs_router",
] 