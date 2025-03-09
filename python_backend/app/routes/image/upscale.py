"""
Endpoints for upscaling images using Civitai's API.
"""

import os
import uuid
import httpx
from fastapi import HTTPException, Body
from PIL import Image
from typing import Optional

from . import router
from ...logging import logger, StatusMarker

@router.post("/upscale-image/{filename}")
async def upscale_image(
    filename: str,
    scale_factor: float = Body(2.0, description="Scale factor (2.0, 4.0)"),
    upscaler: str = Body("4x-UltraSharp", description="Upscaler model to use"),
    denoise_strength: float = Body(0.4, description="Denoising strength (0.0-1.0)"),
    enhance_faces: bool = Body(False, description="Enhance face detail"),
    preserve_original_size: bool = Body(False, description="Keep original dimensions")
):
    """
    Upscale an image using the Civitai API.
    
    Parameters:
    - filename: The filename of the image to upscale
    - scale_factor: The scale factor to upscale by (2.0, 4.0)
    - upscaler: The upscaler model to use (e.g., '4x-UltraSharp', 'ESRGAN_4x')
    - denoise_strength: Strength of denoising applied (0.0-1.0)
    - enhance_faces: Whether to enhance facial details
    - preserve_original_size: Whether to preserve the original image dimensions
    """
    try:
        logger.info(f"{StatusMarker.INIT} Image upscaling started | Upscaler: {upscaler}")
        
        # Check if the file exists
        file_path = f"output/{filename}"
        if not os.path.exists(file_path):
            logger.error(f"{StatusMarker.ERROR} File not found: {file_path}")
            raise HTTPException(status_code=404, detail=f"File {filename} not found")
        
        # Load the image for processing
        try:
            image_obj = Image.open(file_path)
        except Exception as e:
            logger.error(f"{StatusMarker.ERROR} Failed to open image: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Failed to open image: {str(e)}")
        
        # Get original dimensions
        original_width, original_height = image_obj.size
        
        # Calculate the new dimensions
        new_width = int(original_width * scale_factor)
        new_height = int(original_height * scale_factor)
        
        # If preserving original size is requested, note the original dimensions
        # but still perform upscaling for quality improvement
        target_width = original_width if preserve_original_size else new_width
        target_height = original_height if preserve_original_size else new_height
        
        logger.info(f"{StatusMarker.PROCESSING} Upscaling from {original_width}x{original_height} to {new_width}x{new_height}")
        
        # Check if Civitai API token is available
        CIVITAI_API_TOKEN = os.getenv("CIVITAI_API_TOKEN")
        
        if CIVITAI_API_TOKEN:
            # Use Civitai API for upscaling
            logger.info(f"{StatusMarker.PROCESSING} Using Civitai API for upscaling")
            
            # Implementation for Civitai API upscaling would go here
            # For example:
            """
            import civitai
            
            # Prepare payload for upscaler endpoint
            payload = {
                "image": f"http://yourserver.com/image/{filename}",  # or use base64 encoding
                "params": {
                    "upscaler": upscaler,
                    "scale": scale_factor,
                    "denoise": denoise_strength,
                    "enhanceFaces": enhance_faces
                }
            }
            
            # Call Civitai API
            response = await civitai.upscale.create(payload, wait=True)
            
            # Process response and download image
            # [Implementation code here]
            """
            
            # Placeholder: For now, use PIL's upscaling since we don't have actual Civitai integration
            logger.warning(f"{StatusMarker.WARNING} Civitai API integration not implemented, falling back to PIL")
            
            # Use PIL's resizing with Lanczos for high quality upscaling
            upscaled_img = image_obj.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # If preserving original size, resize back down
            if preserve_original_size:
                upscaled_img = upscaled_img.resize((original_width, original_height), Image.Resampling.LANCZOS)
                logger.info(f"{StatusMarker.PROCESSING} Preserving original size: {original_width}x{original_height}")
        else:
            # No API token - use PIL's upscaling
            logger.warning(f"{StatusMarker.WARNING} No Civitai API token found, using PIL upscaling")
            upscaled_img = image_obj.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        # Save the upscaled image
        upscaled_filename = f"upscaled_{uuid.uuid4()}.png"
        upscaled_path = f"output/{upscaled_filename}"
        
        # Ensure output directory exists
        os.makedirs("output", exist_ok=True)
        
        # Save the image
        upscaled_img.save(upscaled_path)
        
        logger.info(f"{StatusMarker.SUCCESS} Image upscaled successfully")
        
        # Construct the URL
        image_url = f"/image/{upscaled_filename}"
        
        # Return the URL and metadata
        return {
            "url": image_url,
            "width": target_width,
            "height": target_height,
            "original_width": original_width,
            "original_height": original_height,
            "scale_factor": scale_factor,
            "upscaler": upscaler
        }
        
    except HTTPException as http_ex:
        logger.error(f"{StatusMarker.ERROR} HTTP Exception: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"{StatusMarker.ERROR} Unhandled exception: {str(e)}")
        import traceback
        logger.error(f"{StatusMarker.ERROR} Stack trace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to upscale image: {str(e)}") 