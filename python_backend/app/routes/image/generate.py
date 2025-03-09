"""
Endpoints for generating images from prompts.
"""

import os
import uuid
import httpx
import asyncio
from fastapi import HTTPException, Request

from . import router
from ...schemas.image_generation import CivitaiImageRequest
from ...logging import logger, StatusMarker
from ...utils.lora_detection import identify_loras_in_prompt
from ...ai.groq_integration import analyze_prompt_with_groq
from ...models_lib import models_lib

# Import civitai SDK
import civitai

@router.post("/generate-image")
async def generate_image(request: CivitaiImageRequest, req: Request):
    """
    Generate images using Civitai's API with the specified model.
    Returns URLs to the generated images.
    
    Parameters:
    - prompt: Text prompt describing the image to generate
    - negative_prompt: Text prompt describing what to avoid in the image
    - model: Model name to use for generation
    - model_urn: Model URN identifier
    - width: Image width (default: 512)
    - height: Image height (default: 512)
    - num_inference_steps: Number of inference steps (default: 30)
    - guidance_scale: Guidance scale (default: 7.5)
    - num_images: Number of images to generate (default: 1, max: 10)
    - additional_networks: Optional dictionary of additional networks (LoRAs) to use
      Format: {"urn:air:sd1:lora:...": {"type": "Lora", "strength": 0.75}}
    """
    try:
        # Create a job ID
        job_id = str(uuid.uuid4())
        logger.info(f"{StatusMarker.INIT} Image generation started | Model: {request.model} | Job ID: {job_id}")
        
        # Validate the model exists in our library
        model_name = request.model
        if model_name not in models_lib["base_models"]:
            logger.error(f"{StatusMarker.ERROR} Model '{model_name}' not found in available models")
            raise HTTPException(status_code=400, detail=f"Model {model_name} not found in models library")
        
        # Get the model URN from our library (or use the one provided)
        model_urn = request.model_urn or models_lib["base_models"][model_name]["air"]
        
        # Extract additional networks (LoRAs) if not explicitly provided
        identified_loras = {}
        additional_networks = request.additional_networks
        
        if not additional_networks:
            # Try to identify LoRAs from the prompt
            identified_loras = identify_loras_in_prompt(request.prompt)
            if identified_loras:
                logger.info(f"{StatusMarker.PROCESSING} Identified {len(identified_loras)} LoRAs in prompt: {', '.join(identified_loras.keys())}")
                additional_networks = identified_loras
        
        # Enhance the prompt using Groq
        original_prompt = request.prompt
        try:
            enhanced_prompt, groq_additional_loras = await analyze_prompt_with_groq(original_prompt)
            logger.info(f"{StatusMarker.PROMPT} Enhanced original prompt: '{original_prompt}' to '{enhanced_prompt[:100]}...'")
            
            # Use Groq's suggested LoRAs if we don't have any yet
            if not additional_networks and groq_additional_loras:
                logger.info(f"{StatusMarker.PROCESSING} Using {len(groq_additional_loras)} LoRAs suggested by Groq")
                additional_networks = groq_additional_loras
            
            # Use the enhanced prompt
            prompt = enhanced_prompt
        except Exception as e:
            logger.error(f"{StatusMarker.ERROR} Failed to enhance prompt: {str(e)}")
            # Use prompt as is if enhancement fails
            prompt = original_prompt
        
        # Validate and limit the number of images
        num_images = min(max(request.num_images or 1, 1), 10)
        logger.info(f"{StatusMarker.PROCESSING} Generating {num_images} images in parallel")
        
        # Check if Civitai API token is available
        CIVITAI_API_TOKEN = os.getenv("CIVITAI_API_TOKEN")
        if not CIVITAI_API_TOKEN:
            logger.error(f"{StatusMarker.ERROR} Civitai API token is not configured")
            raise HTTPException(status_code=500, detail="Civitai API token is not configured")
        
        # Define the async function to generate a single image
        async def generate_single_image(image_index: int, base_url: str):
            # Create prefix for this image's logs with proper indentation
            img_prefix = f"[{image_index+1}/{num_images}]"
            
            try:
                logger.info(f"{StatusMarker.INIT} {img_prefix} Starting generation")
                
                # Prepare the input for Civitai API
                input_data = {
                    "model": model_urn,
                    "params": {
                        "prompt": prompt,
                        "negativePrompt": request.negative_prompt or "(deformed iris, deformed pupils, semi-realistic, cgi, 3d, render, sketch, cartoon, drawing, anime, mutated hands and fingers:1.4), (deformed, distorted, disfigured:1.3)",
                        "scheduler": "EulerA",
                        "steps": request.num_inference_steps or 30,
                        "cfgScale": request.guidance_scale or 7.5,
                        "width": request.width or 512,
                        "height": request.height or 512,
                        "clipSkip": 2,
                        "seed": -1  # Random seed for variety
                    }
                }
                
                # Add additional networks (LoRAs) if provided - at root level not in params
                if additional_networks:
                    input_data["additionalNetworks"] = additional_networks
                
                print("input_data", input_data)
                logger.info(f"{StatusMarker.PROCESSING} {img_prefix} Sending to Civitai")
                
                # Submit the job to Civitai API
                # Use wait=True to wait for the job to complete
                initial_response = await civitai.image.create(input_data, wait=True)
                
                # Default return values
                image_url = None
                civitai_job_id = None
                
                # Since we used wait=True, the job should be complete
                # Check if we received a successful response
                if not initial_response or not initial_response.get('jobs'):
                    logger.error(f"{StatusMarker.ERROR} {img_prefix} No jobs in Civitai response")
                    return None, None
                
                # Get the job from the response
                job = initial_response['jobs'][0]
                civitai_job_id = job.get('jobId')
                
                # Check if the job has a result with an available blob URL
                if job.get('result') and job['result'].get('available'):
                    if job['result'].get('blobUrl'):
                        image_url = job['result']['blobUrl']
                        logger.info(f"{StatusMarker.SUCCESS} {img_prefix} Generation successful")
                else:
                    logger.error(f"{StatusMarker.ERROR} {img_prefix} Job completed but no image URL found")
                    return civitai_job_id, None
                
                # If we got an image URL, download and save it
                local_image_url = None
                if image_url:
                    logger.info(f"{StatusMarker.DOWNLOAD} {img_prefix} Downloading from Civitai")
                    async with httpx.AsyncClient() as client:
                        img_response = await client.get(image_url)
                        
                        if img_response.status_code == 200:
                            # Save the image
                            filename = f"civitai_{uuid.uuid4()}.png"
                            file_path = f"output/{filename}"
                            
                            with open(file_path, "wb") as f:
                                f.write(img_response.content)
                            
                            # Construct the full URL to the image
                            local_image_url = f"{base_url}image/{filename}"
                            logger.info(f"{StatusMarker.SUCCESS} {img_prefix} Saved to server")
                        else:
                            logger.error(f"{StatusMarker.ERROR} {img_prefix} Download failed (HTTP {img_response.status_code})")
                
                return civitai_job_id, local_image_url
                
            except Exception as e:
                logger.error(f"{StatusMarker.ERROR} {img_prefix} Failed: {str(e)}")
                return None, None
        
        # Create tasks for all images
        base_url = str(req.base_url)
        tasks = [generate_single_image(i, base_url) for i in range(num_images)]
        
        # Run all tasks in parallel
        results = await asyncio.gather(*tasks)
        
        # Process the results
        image_urls = []
        civitai_job_ids = []
        
        for civitai_job_id, local_image_url in results:
            if civitai_job_id:
                civitai_job_ids.append(civitai_job_id)
            if local_image_url:
                image_urls.append(local_image_url)
        
        # Return the result
        if not image_urls:
            raise HTTPException(status_code=500, detail="Failed to generate any images")
        
        return {
            "image_urls": image_urls,
            "civitai_job_ids": civitai_job_ids,
            "generation_data": {
                "prompt": prompt,
                "original_prompt": original_prompt,
                "prompt_enhanced": prompt != original_prompt,
                "negative_prompt": request.negative_prompt,
                "model": request.model,
                "loras": additional_networks
            }
        }
        
    except HTTPException as http_ex:
        logger.error(f"{StatusMarker.ERROR} HTTP Exception: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"{StatusMarker.ERROR} Unhandled exception: {str(e)}")
        import traceback
        logger.error(f"{StatusMarker.ERROR} Stack trace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate images: {str(e)}") 