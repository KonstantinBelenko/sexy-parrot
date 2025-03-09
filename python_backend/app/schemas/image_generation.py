"""
Schemas for image generation requests and responses.
"""

from pydantic import BaseModel, validator
from typing import Optional, Dict, Any, List

class TextToImageRequest(BaseModel):
    """Simple text-to-image request model."""
    prompt: str
    width: Optional[int] = 512
    height: Optional[int] = 512

class ImageResponse(BaseModel):
    """Image generation response model."""
    url: str
    prompt: str

class CivitaiImageRequest(BaseModel):
    """Request model for generating images with Civitai API."""
    prompt: str
    negative_prompt: Optional[str] = None
    model: str
    model_urn: str
    width: Optional[int] = 512
    height: Optional[int] = 512
    num_inference_steps: Optional[int] = 30
    guidance_scale: Optional[float] = 7.5
    num_images: Optional[int] = 1
    additional_networks: Optional[Dict[str, Dict[str, Any]]] = None  # Dictionary of LoRA configurations

    # Add validator to ensure num_images is between 1 and 10
    @validator('num_images')
    def validate_num_images(cls, v):
        if v is not None and (v < 1 or v > 10):
            raise ValueError('num_images must be between 1 and 10')
        return v

class RemixImageRequest(BaseModel):
    """Request model for remixing an existing image."""
    image_url: str  # URL of the image to remix
    prompt: str
    negative_prompt: Optional[str] = None
    model: str
    model_urn: str
    additional_networks: Optional[Dict[str, Dict[str, Any]]] = None  # Dictionary of LoRA configurations
    num_images: int = 4  # Default to 4 variations
    width: Optional[int] = 512
    height: Optional[int] = 512
    num_inference_steps: Optional[int] = 30
    guidance_scale: Optional[float] = 7.5 
    strength: Optional[float] = 0.7  # How much to modify the image (0.0-1.0)

class ResizeImageRequest(BaseModel):
    """Request model for resizing an uploaded image."""
    width: Optional[int] = None
    height: Optional[int] = None
    device: Optional[str] = None
    maintain_aspect_ratio: bool = True
    fit_method: str = "fit"
    output_format: str = "PNG"

    @validator('output_format')
    def validate_output_format(cls, v):
        if v not in ["PNG", "JPEG", "JPG", "GIF", "BMP", "WEBP"]:
            raise ValueError('output_format must be a valid image format (PNG, JPEG, JPG, GIF, BMP, WEBP)')
        return v.upper()
        
    @validator('fit_method')
    def validate_fit_method(cls, v):
        if v not in ["fit", "fill", "stretch", "pad"]:
            raise ValueError('fit_method must be one of: fit, fill, stretch, pad')
        return v.lower() 