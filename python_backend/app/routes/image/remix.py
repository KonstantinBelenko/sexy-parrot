"""
Endpoints for remixing images (generating variations).
"""

import os
import uuid
import httpx
import asyncio
import base64
from fastapi import HTTPException, Request
from PIL import Image, ImageEnhance, ImageFilter
import io
import random

from . import router
from ...schemas.image_generation import RemixImageRequest
from ...logging import logger, StatusMarker
from ...models_lib import models_lib
from ...ai.groq_integration import analyze_prompt_with_groq

@router.post("/remix-image")
async def remix_image(request: RemixImageRequest, req: Request):
    """
    Generate variations of an image based on the provided prompt and settings.
    Currently implemented as a placeholder using basic image processing.
    """
    try:
        logger.info(f"{StatusMarker.INIT} Image remix started for model: {request.model}")
        
        # Validate basic parameters
        if not request.image_url:
            raise HTTPException(status_code=400, detail="Image URL is required")
            
        # Set strength within reasonable bounds
        strength = max(min(request.strength or 0.7, 1.0), 0.3)
        
        # Limit number of variations
        num_images = min(max(request.num_images or 4, 1), 4)
        
        # Enhance the prompt using Groq
        original_prompt = request.prompt
        try:
            enhanced_prompt, additional_loras = await analyze_prompt_with_groq(original_prompt)
            logger.info(f"{StatusMarker.PROMPT} Enhanced original prompt: '{original_prompt}' to '{enhanced_prompt[:100]}...'")
        except Exception as e:
            logger.error(f"{StatusMarker.ERROR} Failed to enhance prompt: {str(e)}")
            enhanced_prompt = original_prompt
            additional_loras = {}
        
        # Generate variations
        base_url = str(req.base_url)
        image_urls = await generate_variations(request.image_url, num_images, strength, base_url)
        
        if not image_urls:
            raise HTTPException(status_code=500, detail="Failed to generate image variations")
        
        return {
            "image_urls": image_urls,
            "civitai_job_ids": ["placeholder"] * len(image_urls),
            "remix_data": {
                "prompt": enhanced_prompt,  # Return the enhanced prompt
                "original_prompt": original_prompt,  # Also return the original prompt
                "negative_prompt": request.negative_prompt,
                "model": request.model,
                "strength": strength,
                "source_image": request.image_url,
                "additional_loras": additional_loras,  # Include suggested LoRAs
                "note": "These are placeholder variations created with basic image processing. The enhanced prompt would be used for actual AI generation."
            }
        }
        
    except Exception as e:
        logger.error(f"{StatusMarker.ERROR} Remix error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remix image: {str(e)}")


async def generate_variations(image_url: str, num_images: int, strength: float, base_url: str):
    """Generate simple image variations using PIL."""
    
    # Create tasks for all image variations
    tasks = [create_variation(image_url, i, num_images, strength, base_url) 
             for i in range(num_images)]
    
    # Run all tasks in parallel and return successful results
    results = await asyncio.gather(*tasks)
    return [url for url in results if url]


async def create_variation(image_url: str, index: int, total: int, strength: float, base_url: str):
    """Create a single image variation."""
    
    img_prefix = f"[{index+1}/{total}]"
    
    try:
        # Download source image
        logger.info(f"{StatusMarker.PROCESSING} {img_prefix} Downloading source image")
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url)
            if response.status_code != 200:
                logger.error(f"{StatusMarker.ERROR} {img_prefix} Download failed: HTTP {response.status_code}")
                return None
            
            # Load and process image
            image = Image.open(io.BytesIO(response.content))
            if image.mode != 'RGB':
                image = image.convert('RGB')
                
            # Apply effects based on strength
            # Higher strength = more noticeable changes
            effect_strength = strength * 1.5  # Amplify for more visible changes
            
            # Apply simple adjustments
            contrast = ImageEnhance.Contrast(image)
            image = contrast.enhance(0.8 + random.random() * effect_strength)
            
            brightness = ImageEnhance.Brightness(image)
            image = brightness.enhance(0.9 + random.random() * effect_strength)
            
            # Apply blur or sharpen based on index for more variety
            if index % 2 == 0:
                image = image.filter(ImageFilter.GaussianBlur(radius=0.5 * effect_strength))
            else:
                image = image.filter(ImageFilter.SHARPEN)
            
            # Save the remixed image
            filename = f"remix_{uuid.uuid4()}.png"
            file_path = f"output/{filename}"
            os.makedirs("output", exist_ok=True)
            image.save(file_path)
            
            # Return URL to the image
            image_url = f"{base_url}image/{filename}"
            logger.info(f"{StatusMarker.SUCCESS} {img_prefix} Created variation")
            return image_url
            
    except Exception as e:
        logger.error(f"{StatusMarker.ERROR} {img_prefix} Error: {str(e)}")
        return None 