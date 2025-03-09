"""
Utility functions for processing images.
"""

import io
import uuid
import base64
from typing import List, Dict, Any, Optional, Tuple
from fastapi import HTTPException, UploadFile
from PIL import Image

# Dictionary of common device resolutions
DEVICE_RESOLUTIONS = {
    "iphone": (1170, 2532),  # iPhone 13/14 Pro
    "iphone_plus": (1284, 2778),  # iPhone 13/14 Pro Max
    "iphone_se": (750, 1334),  # iPhone SE
    "ipad": (1640, 2360),  # iPad Air
    "ipad_pro": (2048, 2732),  # iPad Pro 12.9
    "macbook": (1440, 900),  # MacBook Air 13"
    "macbook_pro": (1800, 1169),  # MacBook Pro 14"
    "desktop_hd": (1920, 1080),  # HD Monitor
    "desktop_4k": (3840, 2160),  # 4K Monitor
    "android": (1080, 2400),  # Common Android resolution
}

async def process_images(images: List[UploadFile]) -> List[Dict[str, Any]]:
    """
    Process uploaded images, save them to disk, and prepare for API consumption.
    
    Args:
        images: List of uploaded image files
        
    Returns:
        List of processed image info with paths, base64 encoding, etc.
        
    Raises:
        HTTPException: If image processing fails
    """
    processed_images = []
    
    for idx, img in enumerate(images):
        # Read image content
        content = await img.read()
        
        # Save image to uploads folder
        filename = f"upload_{uuid.uuid4()}.png"
        filepath = f"uploads/{filename}"
        
        with open(filepath, "wb") as f:
            f.write(content)
        
        # Create thumbnail and base64 encode for API
        try:
            image = Image.open(io.BytesIO(content))
            # Resize for API consumption
            image.thumbnail((512, 512))
            buffered = io.BytesIO()
            image.save(buffered, format="PNG")
            img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
            
            processed_images.append({
                "index": idx,
                "filename": filename,
                "filepath": filepath,
                "base64": img_base64,
                "mime_type": img.content_type or "image/png"
            })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")
    
    return processed_images

async def resize_image(
    image_data: bytes, 
    width: Optional[int] = None, 
    height: Optional[int] = None, 
    device: Optional[str] = None,
    maintain_aspect_ratio: bool = True,
    fit_method: str = "fit",
    output_format: str = "PNG",
    background_color: tuple = (0, 0, 0)  # Default black background for padding
) -> Tuple[bytes, Dict[str, Any]]:
    """
    Resize an image to specified dimensions or a predefined device format.
    
    Args:
        image_data: Raw image data bytes
        width: Desired width in pixels (overridden if device is specified)
        height: Desired height in pixels (overridden if device is specified)
        device: Device preset name (e.g., "iphone", "ipad", "desktop_hd")
        maintain_aspect_ratio: Whether to preserve aspect ratio when resizing
        fit_method: How to fit the image to target dimensions:
            - "fit": Scale to fit within dimensions, may leave empty space (default)
            - "fill": Scale to fill dimensions completely, may crop parts of image
            - "stretch": Force to exact dimensions, may distort image
            - "pad": Keep entire image visible and add padding to fill dimensions
        output_format: Output image format (PNG, JPEG, etc.)
        background_color: RGB tuple for background color when padding (default: black)
        
    Returns:
        Tuple containing:
        - Resized image data as bytes
        - Metadata dictionary with format, dimensions, size
        
    Raises:
        HTTPException: If image processing fails or invalid parameters
    """
    try:
        # Load the image
        img = Image.open(io.BytesIO(image_data))
        original_format = img.format or "PNG"
        original_size = (img.width, img.height)
        original_ratio = original_size[0] / original_size[1]
        
        # Determine target dimensions
        target_width, target_height = width, height
        
        # Use device preset if specified
        if device:
            device = device.lower()
            if device in DEVICE_RESOLUTIONS:
                target_width, target_height = DEVICE_RESOLUTIONS[device]
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Unknown device '{device}'. Available devices: {', '.join(DEVICE_RESOLUTIONS.keys())}"
                )
        
        # Validate dimensions
        if not (target_width or target_height):
            raise HTTPException(
                status_code=400, 
                detail="Either width, height, or device must be specified"
            )
            
        # Handle different fit methods
        if fit_method == "stretch" or not maintain_aspect_ratio:
            # Just force the dimensions, potentially distorting the image
            if not target_width:
                target_width = int(target_height * original_ratio)
            if not target_height:
                target_height = int(target_width / original_ratio)
                
            resized_img = img.resize((target_width, target_height), Image.LANCZOS)
            
        elif fit_method == "fill":
            # Scale and crop to fill the target dimensions
            if not target_width:
                target_width = int(target_height * original_ratio)
            if not target_height:
                target_height = int(target_width / original_ratio)
                
            # Calculate dimensions that maintain aspect ratio while filling the target area
            target_ratio = target_width / target_height
            
            if original_ratio > target_ratio:  # Image is wider than target
                # Scale to match height, then crop width
                scale_factor = target_height / original_size[1]
                new_width = int(original_size[0] * scale_factor)
                new_height = target_height
                
                # Resize to new dimensions
                temp_img = img.resize((new_width, new_height), Image.LANCZOS)
                
                # Calculate crop box
                left_crop = (new_width - target_width) // 2
                resized_img = temp_img.crop((left_crop, 0, left_crop + target_width, target_height))
                
            else:  # Image is taller than target
                # Scale to match width, then crop height
                scale_factor = target_width / original_size[0]
                new_width = target_width
                new_height = int(original_size[1] * scale_factor)
                
                # Resize to new dimensions
                temp_img = img.resize((new_width, new_height), Image.LANCZOS)
                
                # Calculate crop box
                top_crop = (new_height - target_height) // 2
                resized_img = temp_img.crop((0, top_crop, target_width, top_crop + target_height))
        
        elif fit_method == "pad":
            # Ensure entire image is visible within target dimensions by adding padding
            if not target_width:
                target_width = int(target_height * original_ratio)
            if not target_height:
                target_height = int(target_width / original_ratio)
                
            # Calculate the scaling factor to fit within the target dimensions
            target_ratio = target_width / target_height
            
            if original_ratio > target_ratio:  # Image is wider than target
                # Scale by width
                new_width = target_width
                new_height = int(new_width / original_ratio)
            else:  # Image is taller than target
                # Scale by height
                new_height = target_height
                new_width = int(new_height * original_ratio)
            
            # Resize the image to fit within target dimensions
            resized = img.resize((new_width, new_height), Image.LANCZOS)
            
            # Create a new image with the target dimensions and the specified background color
            resized_img = Image.new("RGB", (target_width, target_height), background_color)
            
            # Calculate position to paste (center the image)
            paste_x = (target_width - new_width) // 2
            paste_y = (target_height - new_height) // 2
            
            # Paste the resized image onto the background
            resized_img.paste(resized, (paste_x, paste_y))
                
        else:  # "fit" is the default
            # Calculate new dimensions maintaining aspect ratio
            if target_width and not target_height:
                target_height = int(target_width / original_ratio)
            elif target_height and not target_width:
                target_width = int(target_height * original_ratio)
            # If both dimensions are provided, fit within while maintaining ratio
            elif target_width and target_height:
                new_ratio = target_width / target_height
                
                if original_ratio > new_ratio:  # Image is wider than target
                    target_height = int(target_width / original_ratio)
                else:  # Image is taller than target
                    target_width = int(target_height * original_ratio)
            
            # Perform the resize
            resized_img = img.resize((target_width, target_height), Image.LANCZOS)
        
        # Save the result to a bytes buffer
        buffered = io.BytesIO()
        resized_img.save(buffered, format=output_format)
        resized_data = buffered.getvalue()
        
        # Prepare metadata
        metadata = {
            "original_format": original_format,
            "original_dimensions": original_size,
            "resized_dimensions": (resized_img.width, resized_img.height),
            "device": device if device else None,
            "output_format": output_format,
            "file_size_bytes": len(resized_data),
            "fit_method": fit_method,
            "aspect_ratio": "Maintain" if maintain_aspect_ratio else "Stretch"
        }
        
        return resized_data, metadata
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image resize failed: {str(e)}") 