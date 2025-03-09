"""
Image-related API endpoints.
"""

from fastapi import APIRouter

# Create a router for all image endpoints
router = APIRouter(tags=["image-generation"])

# Import and include all image-related routes
from .retrieve import *
from .generate import *
from .resize import *
from .upscale import *
from .remix import *

# Export the router
__all__ = ["router"] 