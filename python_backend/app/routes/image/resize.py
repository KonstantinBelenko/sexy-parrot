"""
Endpoints for resizing images and creating wallpapers.
"""

import os
import uuid
from fastapi import HTTPException, Body
from PIL import Image, ImageOps
from typing import Optional, Literal

from . import router
from ...logging import logger, StatusMarker

@router.post("/resize-image")
async def resize_image(
    image: str = Body(..., description="URL or base64 encoded image"),
    width: int = Body(None, description="Target width in pixels"),
    height: int = Body(None, description="Target height in pixels"),
    device: Optional[str] = Body(None, description="Device type for preset dimensions"),
    maintain_aspect_ratio: bool = Body(True, description="Whether to maintain aspect ratio"),
    fit_method: Literal["cover", "contain", "fill"] = Body("contain", description="How to fit the image"),
    output_format: Literal["png", "jpeg", "webp"] = Body("png", description="Output format"),
    background_color: str = Body("#000000", description="Background color for padding")
):
    """
    Resize an image to the specified dimensions.
    You can provide an image URL or a base64 encoded image.
    
    Parameters:
    - image: URL or base64 encoded image
    - width: Target width in pixels
    - height: Target height in pixels
    - device: Device type for preset dimensions
    - maintain_aspect_ratio: Whether to maintain aspect ratio
    - fit_method: How to fit the image within dimensions (cover, contain, fill)
    - output_format: Output format (png, jpeg, webp)
    - background_color: Background color for padding
    """
    try:
        logger.info(f"{StatusMarker.INIT} Image resize started")
        
        # Logic to load image from URL or base64
        # Implementation would go here...
        
        # For mock implementation, we'll assume an image_obj is loaded
        # Replace this in the real implementation with proper image loading code
        image_obj = Image.new('RGB', (512, 512), color='white')
        
        # If device is specified, get dimensions from device presets
        if device:
            # Map of device presets
            device_presets = {
                "iphone": (1170, 2532),  # iPhone 13 Pro
                "ipad": (1640, 2360),    # iPad Air
                "mac": (1512, 982),      # MacBook Pro 14"
                "desktop": (1920, 1080), # Full HD
                "4k": (3840, 2160)       # 4K
            }
            
            if device not in device_presets:
                logger.error(f"{StatusMarker.ERROR} Invalid device preset: {device}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid device preset. Available presets: {', '.join(device_presets.keys())}"
                )
            
            width, height = device_presets[device]
            logger.info(f"{StatusMarker.PROCESSING} Using {device} preset: {width}x{height}")
        
        # Check if width and height are specified
        if width is None and height is None:
            logger.error(f"{StatusMarker.ERROR} Both width and height are missing")
            raise HTTPException(
                status_code=400, 
                detail="You must specify either width, height, or a device preset"
            )
        
        # Calculate missing dimension to maintain aspect ratio
        original_width, original_height = image_obj.size
        
        if maintain_aspect_ratio:
            if width is None:
                # Calculate width based on height
                width = int(original_width * (height / original_height))
            elif height is None:
                # Calculate height based on width
                height = int(original_height * (width / original_width))
            
            logger.info(f"{StatusMarker.PROCESSING} Maintaining aspect ratio, new dimensions: {width}x{height}")
        
        # Apply the fit method
        if fit_method == "cover":
            # Scale the image to cover the target dimensions (may crop)
            ratio = max(width / original_width, height / original_height)
            new_size = (int(original_width * ratio), int(original_height * ratio))
            resized_img = image_obj.resize(new_size, Image.Resampling.LANCZOS)
            
            # Crop to fit the target dimensions
            left = (new_size[0] - width) // 2
            top = (new_size[1] - height) // 2
            right = left + width
            bottom = top + height
            resized_img = resized_img.crop((left, top, right, bottom))
            
        elif fit_method == "contain":
            # Scale the image to fit within the target dimensions (may add padding)
            ratio = min(width / original_width, height / original_height)
            new_size = (int(original_width * ratio), int(original_height * ratio))
            resized_img = image_obj.resize(new_size, Image.Resampling.LANCZOS)
            
            # Create a background image and paste the resized image in the center
            bg_color = background_color
            background = Image.new('RGB', (width, height), bg_color)
            paste_x = (width - new_size[0]) // 2
            paste_y = (height - new_size[1]) // 2
            background.paste(resized_img, (paste_x, paste_y))
            resized_img = background
            
        else:  # fit_method == "fill"
            # Just resize to the target dimensions, ignoring aspect ratio
            resized_img = image_obj.resize((width, height), Image.Resampling.LANCZOS)
        
        # Save the resized image
        filename = f"resized_{uuid.uuid4()}.{output_format}"
        file_path = f"output/{filename}"
        
        # Ensure output directory exists
        os.makedirs("output", exist_ok=True)
        
        # Save the image in the requested format
        resized_img.save(file_path, format=output_format.upper())
        
        # Construct the URL
        image_url = f"/image/{filename}"
        
        logger.info(f"{StatusMarker.SUCCESS} Image resized successfully: {width}x{height}")
        
        # Return the URL and metadata
        return {
            "url": image_url,
            "width": width,
            "height": height,
            "original_width": original_width,
            "original_height": original_height,
            "fit_method": fit_method,
            "format": output_format
        }
        
    except HTTPException as http_ex:
        logger.error(f"{StatusMarker.ERROR} HTTP Exception: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"{StatusMarker.ERROR} Unhandled exception: {str(e)}")
        import traceback
        logger.error(f"{StatusMarker.ERROR} Stack trace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to resize image: {str(e)}")

@router.post("/wallpaper/{device}")
async def create_wallpaper(
    device: str,
    image: str = Body(..., description="URL or base64 encoded image"),
    fit_method: Literal["cover", "contain", "fill"] = Body("contain", description="How to fit the image"),
    output_format: Literal["png", "jpeg", "webp"] = Body("png", description="Output format"),
    background_color: str = Body("#000000", description="Background color for padding")
):
    """
    Create a wallpaper for a specific device by resizing an image.
    
    Parameters:
    - device: Device type (iphone, ipad, mac, desktop, 4k)
    - image: URL or base64 encoded image
    - fit_method: How to fit the image within dimensions (cover, contain, fill)
    - output_format: Output format (png, jpeg, webp)
    - background_color: Background color for padding
    """
    # Map of device presets
    device_presets = {
        "iphone": (1170, 2532),  # iPhone 13 Pro
        "ipad": (1640, 2360),    # iPad Air
        "mac": (1512, 982),      # MacBook Pro 14"
        "desktop": (1920, 1080), # Full HD
        "4k": (3840, 2160)       # 4K
    }
    
    # Validate the device
    if device not in device_presets:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid device. Available devices: {', '.join(device_presets.keys())}"
        )
    
    # Get dimensions from device presets
    width, height = device_presets[device]
    
    # Call the resize endpoint with the device dimensions
    return await resize_image(
        image=image,
        width=width,
        height=height,
        device=None,  # We already have the dimensions
        maintain_aspect_ratio=True,
        fit_method=fit_method,
        output_format=output_format,
        background_color=background_color
    ) 