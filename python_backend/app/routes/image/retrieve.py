"""
Endpoints for retrieving generated images.
"""

import os
from fastapi import HTTPException
from fastapi.responses import FileResponse

from . import router
from ...logging import logger, StatusMarker

@router.get("/image/{filename}")
async def get_image(filename: str):
    """Serve the generated images"""
    image_path = f"output/{filename}"
    if not os.path.isfile(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path) 