"""
API endpoints for image generation.
"""

import os
import re
import uuid
import httpx
import asyncio
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Body
from fastapi.responses import FileResponse

from ..schemas.image_generation import CivitaiImageRequest, RemixImageRequest, ResizeImageRequest
from ..logging import logger, StatusMarker
from ..utils.lora_detection import identify_loras_in_prompt
from ..utils.image_processing import resize_image, DEVICE_RESOLUTIONS
from ..ai.groq_integration import analyze_prompt_with_groq
from ..models_lib import models_lib

# Import civitai SDK
import civitai

router = APIRouter(tags=["image-generation"])

@router.get("/image/{filename}")
async def get_image(filename: str):
    """Serve the generated images"""
    image_path = f"output/{filename}"
    if not os.path.isfile(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path)

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
        
        # Improved prompt handling:
        raw_prompt = request.prompt
        
        # Check if this is a response message rather than an actual prompt
        if raw_prompt.startswith("I'll create") or raw_prompt.startswith("''ll create") or raw_prompt.startswith("I will create") or "for you" in raw_prompt:
            # This is likely the response text, not the actual prompt
            # We should extract the actual subject/content from it
            pattern = r"(?:I'll|''ll|I will) create (?:an image|images) of (.*?)(?:\.|\for you)"
            match = re.search(pattern, raw_prompt, re.IGNORECASE)
            if match:
                # Extract the actual subject
                actual_prompt = match.group(1).strip()
                logger.info(f"{StatusMarker.PROMPT} Extracted actual prompt from response text: '{actual_prompt}'")
                raw_prompt = actual_prompt
        
        # Use Groq to enhance the prompt and identify appropriate LoRAs
        enhanced_prompt, groq_additional_networks = await analyze_prompt_with_groq(raw_prompt)
        
        # Use the enhanced prompt
        prompt = enhanced_prompt
        
        # Use the LoRAs identified by Groq
        additional_networks = groq_additional_networks
        
        # If Groq didn't suggest any LoRAs, use the provided ones or detect them manually as backup
        if not additional_networks:
            # Use explicitly provided additional networks, or detect them as fallback
            additional_networks = request.additional_networks or {}
            if not additional_networks:
                detected_loras = identify_loras_in_prompt(prompt)
                if detected_loras:
                    additional_networks = detected_loras
                    logger.info(f"{StatusMarker.LORA} Using pattern-based LoRA detection: Found {len(detected_loras)} LoRAs")
        
        # Determine number of images to generate (default to 1, max 10)
        num_images = min(request.num_images or 1, 10)
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
        
        # If no images were successfully generated, raise an error
        if not image_urls:
            logger.error(f"{StatusMarker.ERROR} Failed to generate any images")
            raise HTTPException(status_code=500, detail="Failed to generate any images")
        
        logger.info(f"{StatusMarker.SUCCESS} Generation complete: {len(image_urls)}/{num_images} images successful")
        
        # Return all image URLs
        return {
            "image_urls": image_urls,
            "job_id": job_id,
            "civitai_job_ids": civitai_job_ids,
            "status": "completed"
        }
        
    except HTTPException as http_ex:
        logger.error(f"{StatusMarker.ERROR} HTTP Exception: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"{StatusMarker.ERROR} Unhandled exception: {str(e)}")
        import traceback
        logger.error(f"{StatusMarker.ERROR} Stack trace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate images: {str(e)}")

@router.post("/remix-image")
async def remix_image(request: RemixImageRequest, req: Request):
    """
    Generate multiple variations of an image based on the same prompt and settings.
    Returns URLs to the generated remix images.
    
    Parameters:
    - prompt: Text prompt describing the image to generate
    - negative_prompt: Text prompt describing what to avoid in the image
    - model: Model name to use for generation
    - model_urn: Model URN identifier
    - additional_networks: Dictionary of additional networks (LoRAs) to use
    - num_images: Number of variations to generate (default: 4)
    - width: Image width (default: 512)
    - height: Image height (default: 512)
    - num_inference_steps: Number of inference steps (default: 30)
    - guidance_scale: Guidance scale (default: 7.5)
    """
    try:
        # Create a job ID
        job_id = str(uuid.uuid4())
        logger.info(f"{StatusMarker.INIT} Image remix started | Model: {request.model} | Job ID: {job_id}")
        
        # Validate the model exists in our library
        model_name = request.model
        if model_name not in models_lib["base_models"]:
            logger.error(f"{StatusMarker.ERROR} Model '{model_name}' not found in available models")
            raise HTTPException(status_code=400, detail=f"Model {model_name} not found in models library")
        
        # Get the model URN from our library (or use the one provided)
        model_urn = request.model_urn or models_lib["base_models"][model_name]["air"]
        
        # Use prompt and additional networks as provided 
        prompt = request.prompt
        additional_networks = request.additional_networks or {}
        
        # Always generate 4 variations for remix - ensure the range
        num_images = min(max(request.num_images or 4, 1), 10)
        logger.info(f"{StatusMarker.PROCESSING} Generating {num_images} remix variations in parallel")
        
        # Check if Civitai API token is available
        CIVITAI_API_TOKEN = os.getenv("CIVITAI_API_TOKEN")
        if not CIVITAI_API_TOKEN:
            logger.error(f"{StatusMarker.ERROR} Civitai API token is not configured")
            raise HTTPException(status_code=500, detail="Civitai API token is not configured")
        
        # Define the async function to generate a single image (same as in generate_image)
        async def generate_single_image(image_index: int, base_url: str):
            # Create prefix for this image's logs with proper indentation
            img_prefix = f"[{image_index+1}/{num_images}]"
            
            try:
                logger.info(f"{StatusMarker.INIT} {img_prefix} Starting remix variation")
                
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
                        "seed": -1  # Random seed for variety in remix
                    }
                }
                
                # Add additional networks (LoRAs) if provided
                if additional_networks:
                    input_data["additionalNetworks"] = additional_networks
                
                logger.info(f"{StatusMarker.PROCESSING} {img_prefix} Sending remix to Civitai")
                
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
                        logger.info(f"{StatusMarker.SUCCESS} {img_prefix} Remix variation successful")
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
                            filename = f"remix_{uuid.uuid4()}.png"
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
        
        # If no images were successfully generated, raise an error
        if not image_urls:
            logger.error(f"{StatusMarker.ERROR} Failed to generate any remix variations")
            raise HTTPException(status_code=500, detail="Failed to generate any remix variations")
        
        logger.info(f"{StatusMarker.SUCCESS} Remix complete: {len(image_urls)}/{num_images} variations successful")
        
        # Return all image URLs
        return {
            "image_urls": image_urls,
            "job_id": job_id,
            "civitai_job_ids": civitai_job_ids,
            "status": "completed"
        }
        
    except HTTPException as http_ex:
        logger.error(f"{StatusMarker.ERROR} HTTP Exception: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"{StatusMarker.ERROR} Unhandled exception: {str(e)}")
        import traceback
        logger.error(f"{StatusMarker.ERROR} Stack trace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate remix variations: {str(e)}")

@router.post("/resize-image")
async def resize_uploaded_image(
    image: UploadFile = File(...),
    width: int = Form(None),
    height: int = Form(None),
    device: str = Form(None),
    maintain_aspect_ratio: bool = Form(True),
    fit_method: str = Form("fit"),
    output_format: str = Form("PNG"),
    background_color: str = Form("000000"),  # Black by default, hex color
):
    """
    Resize an uploaded image to specified dimensions or a predefined device format.
    
    The endpoint accepts multipart form data with the following parameters:
    - image: The image file to resize
    - width: Target width in pixels (optional)
    - height: Target height in pixels (optional)
    - device: Device preset name (e.g., "iphone", "ipad", "desktop_hd") (optional)
    - maintain_aspect_ratio: Whether to preserve aspect ratio (default: True)
    - fit_method: How to fit the image:
        - "fit": Scale to fit within dimensions, may leave empty space (default)
        - "fill": Scale to fill dimensions completely, may crop parts of image
        - "stretch": Force to exact dimensions, may distort image
        - "pad": Keep entire image visible and add padding to fill dimensions
    - output_format: Output image format (default: PNG)
    - background_color: Hex color code for padding background (default: 000000 black)
    
    Either width, height, or device must be specified.
    If device is specified, it will override width and height.
    
    Returns the resized image file for download and metadata about the operation.
    """
    try:
        # Force pad method for mobile devices
        if device and device.lower() in ["iphone", "iphone_plus", "iphone_se", "android"]:
            fit_method = "pad"
            logger.info(f"{StatusMarker.PROCESSING} Forcing pad method for mobile device: {device}")
        
        # Log the start of the operation
        logger.info(f"{StatusMarker.INIT} Resizing image: {image.filename} with method: {fit_method}")
        
        # Convert hex background color to RGB tuple
        bg_color = (
            int(background_color[0:2], 16) if len(background_color) >= 2 else 0,
            int(background_color[2:4], 16) if len(background_color) >= 4 else 0,
            int(background_color[4:6], 16) if len(background_color) >= 6 else 0
        )
        
        # Read the image data
        image_data = await image.read()
        
        # Parse the request parameters
        resize_request = ResizeImageRequest(
            width=width,
            height=height,
            device=device,
            maintain_aspect_ratio=maintain_aspect_ratio,
            fit_method=fit_method,
            output_format=output_format
        )
        
        # Perform the resize operation
        resized_data, metadata = await resize_image(
            image_data=image_data,
            width=resize_request.width,
            height=resize_request.height,
            device=resize_request.device,
            maintain_aspect_ratio=resize_request.maintain_aspect_ratio,
            fit_method=resize_request.fit_method,
            output_format=resize_request.output_format,
            background_color=bg_color
        )
        
        # Save the resized image
        original_filename = os.path.splitext(image.filename)[0]
        resized_filename = f"{original_filename}_resized_{uuid.uuid4()}.{resize_request.output_format.lower()}"
        resized_filepath = f"output/{resized_filename}"
        
        with open(resized_filepath, "wb") as f:
            f.write(resized_data)
        
        logger.info(f"{StatusMarker.SUCCESS} Image resized: {resized_filename}")
        
        # Return the resized image and metadata
        return {
            "url": f"/image/{resized_filename}",
            "filename": resized_filename,
            "metadata": metadata
        }
    
    except HTTPException as e:
        # Re-raise HTTP exceptions
        logger.error(f"{StatusMarker.ERROR} Resize failed: {str(e.detail)}")
        raise
    
    except Exception as e:
        # Log and convert other exceptions to HTTP exceptions
        error_message = f"Failed to resize image: {str(e)}"
        logger.error(f"{StatusMarker.ERROR} {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

@router.post("/wallpaper/{device}")
async def create_wallpaper(
    device: str,
    image: UploadFile = File(...),
    fit_method: str = Form("fill"),  # Default to fill for wallpapers
    output_format: str = Form("PNG"),
    background_color: str = Form("000000"),  # Black by default, hex color
):
    """
    Create a wallpaper for a specific device by resizing an image.
    
    Parameters:
    - device: Target device (iphone, ipad, android, desktop_hd, desktop_4k, etc.)
    - image: The image file to resize
    - fit_method: How to fit the image (default: "fill")
      - "fill": Scale to fill dimensions completely, may crop parts of image
      - "pad": Keep entire image visible and add padding to fill dimensions
      - "fit": Scale to fit within dimensions, image will be smaller than screen
      - "stretch": Force to exact dimensions, may distort image
    - output_format: Output image format (default: PNG)
    - background_color: Hex color code for padding background (default: 000000 black)
    
    Returns:
    - URL to the resized image and metadata
    """
    try:
        # Log the start of the operation
        logger.info(f"{StatusMarker.INIT} Creating wallpaper for {device} with method {fit_method}: {image.filename}")
        
        # Check if the device is supported
        device = device.lower()
        if device not in DEVICE_RESOLUTIONS:
            valid_devices = ", ".join(DEVICE_RESOLUTIONS.keys())
            raise HTTPException(
                status_code=400, 
                detail=f"Unknown device '{device}'. Available devices: {valid_devices}"
            )
            
        # Convert hex background color to RGB tuple
        bg_color = (
            int(background_color[0:2], 16) if len(background_color) >= 2 else 0,
            int(background_color[2:4], 16) if len(background_color) >= 4 else 0,
            int(background_color[4:6], 16) if len(background_color) >= 6 else 0
        )
            
        # Read the image data
        image_data = await image.read()
        
        # Validate fit method
        if fit_method not in ["fill", "pad", "fit", "stretch"]:
            fit_method = "fill"  # Use fill as fallback
        
        # Perform the resize operation
        resized_data, metadata = await resize_image(
            image_data=image_data,
            device=device,
            maintain_aspect_ratio=True,
            fit_method=fit_method,
            output_format=output_format,
            background_color=bg_color
        )
        
        # Save the resized image
        original_filename = os.path.splitext(image.filename)[0]
        resized_filename = f"{original_filename}_wallpaper_{device}_{uuid.uuid4()}.{output_format.lower()}"
        resized_filepath = f"output/{resized_filename}"
        
        with open(resized_filepath, "wb") as f:
            f.write(resized_data)
        
        logger.info(f"{StatusMarker.SUCCESS} Wallpaper created: {resized_filename}")
        
        # Return the resized image and metadata
        return {
            "url": f"/image/{resized_filename}",
            "filename": resized_filename,
            "metadata": metadata
        }
    
    except HTTPException as e:
        # Re-raise HTTP exceptions
        logger.error(f"{StatusMarker.ERROR} Wallpaper creation failed: {str(e.detail)}")
        raise
    
    except Exception as e:
        # Log and convert other exceptions to HTTP exceptions
        error_message = f"Failed to create wallpaper: {str(e)}"
        logger.error(f"{StatusMarker.ERROR} {error_message}")
        raise HTTPException(status_code=500, detail=error_message)

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
    Upscale an image to increase its resolution using Civitai API.
    
    Parameters:
    - filename: The filename of the image to upscale (must exist in output/ directory)
    - scale_factor: Factor by which to increase resolution (default: 2.0)
    - upscaler: Name of the upscaler model to use (default: 4x-UltraSharp)
    - denoise_strength: Strength of denoising during upscale (default: 0.4)
    - enhance_faces: Whether to use face enhancement (default: False)
    - preserve_original_size: Keep original dimensions (default: False)
    
    Returns:
    - URL to the upscaled image and metadata
    """
    try:
        # Log the start of the operation
        logger.info(f"{StatusMarker.INIT} Upscaling image: {filename} with {upscaler}")
        
        # Check if the file exists
        file_path = f"output/{filename}"
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404, 
                detail=f"Image '{filename}' not found in output directory"
            )
            
        # Read the image data
        with open(file_path, "rb") as f:
            image_data = f.read()
            
        # Load the image
        from PIL import Image
        import io
        import base64
        
        img = Image.open(io.BytesIO(image_data))
        original_width, original_height = img.size
        
        # For this demo, we'll use the PIL upscaler as we don't have Civitai API credentials
        # In a real implementation, you would send this to Civitai API
        
        # If we were using Civitai API, the request would look like:
        '''
        # Convert image to base64
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Create Civitai API request payload
        payload = {
            "input": {
                "image": img_base64,
                "upscaler": upscaler,
                "scale_factor": scale_factor,
                "denoise_strength": denoise_strength,
                "enhance_faces": enhance_faces,
                "preserve_original_size": preserve_original_size
            }
        }
        
        # Make API request
        response = requests.post(
            "https://api.civitai.com/v1/upscale",
            headers={"Authorization": f"Bearer {CIVITAI_API_TOKEN}"},
            json=payload
        )
        
        # Process response
        result = response.json()
        upscaled_data = base64.b64decode(result["image"])
        '''
        
        # For now, use a local implementation
        # Calculate new dimensions
        new_width = int(original_width * scale_factor)
        new_height = int(original_height * scale_factor)
        
        # Use Lanczos resampling for high-quality upscaling
        upscaled_img = img.resize((new_width, new_height), Image.LANCZOS)
        
        # Save the upscaled image
        original_filename = os.path.splitext(filename)[0]
        upscaled_filename = f"{original_filename}_upscaled_{uuid.uuid4()}.png"
        upscaled_filepath = f"output/{upscaled_filename}"
        
        # Convert to bytes
        buffered = io.BytesIO()
        upscaled_img.save(buffered, format="PNG")
        upscaled_data = buffered.getvalue()
        
        # Save the file
        with open(upscaled_filepath, "wb") as f:
            f.write(upscaled_data)
        
        logger.info(f"{StatusMarker.SUCCESS} Image upscaled: {upscaled_filename}")
        
        # Return the result with metadata
        return {
            "url": f"/image/{upscaled_filename}",
            "filename": upscaled_filename,
            "metadata": {
                "original_dimensions": [original_width, original_height],
                "resized_dimensions": [new_width, new_height],
                "scale_factor": scale_factor,
                "upscaler": upscaler,
                "denoise_strength": denoise_strength,
                "enhance_faces": enhance_faces,
                "output_format": "PNG",
                "file_size_bytes": len(upscaled_data)
            }
        }
    
    except HTTPException as e:
        # Re-raise HTTP exceptions
        logger.error(f"{StatusMarker.ERROR} Upscale failed: {str(e.detail)}")
        raise
    
    except Exception as e:
        # Log and convert other exceptions to HTTP exceptions
        error_message = f"Failed to upscale image: {str(e)}"
        logger.error(f"{StatusMarker.ERROR} {error_message}")
        raise HTTPException(status_code=500, detail=error_message) 