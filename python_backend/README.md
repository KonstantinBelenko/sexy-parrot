# Text to Image API

A simple REST API for text-to-image generation built with FastAPI.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set your Groq API key in the main.py file or environment variable.

3. Run the server:
```bash
python run.py
```

The API will be available at `http://localhost:8000`.

## API Endpoints

### GET /
Health check endpoint that confirms the API is running.

### POST /interpret
Analyze text input and optional images using Groq API to determine job type (txt, txt2img, or img2img).
Returns the job type and a customized response message from the LLM explaining how it will handle the request.

**Request Form Data:**
- `text`: The text request to process
- `images`: (Optional) List of image files to upload

**Response for txt2img or img2img types:**
```json
{
  "type": "txt2img",  // or "img2img"
  "response_text": "I'll create an image of a beautiful landscape with mountains and rivers based on your description.",
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "number_of_images": 0
}
```

**Response for txt type:**
```json
{
  "type": "txt",
  "response_text": "I'll answer your question about mountain landscapes."
}
```

**Response for resize type:**
```json
{
  "type": "resize",
  "response_text": "I'll resize your image to fit an iPhone screen.",
  "resized_image_url": "/image/photo_resized_3fa85f64-5717-4562-b3fc-2c963f66afa6.png",
  "metadata": {
    "original_format": "JPEG",
    "original_dimensions": [4032, 3024],
    "resized_dimensions": [1170, 2532],
    "device": "iphone",
    "output_format": "PNG",
    "file_size_bytes": 1234567,
    "fit_method": "fill",
    "aspect_ratio": "Maintain"
  }
}
```

For "txt" type requests, no job is created and job_id/number_of_images fields are not returned.

The endpoint uses Groq API with the `deepseek-r1-distill-llama-70b` model to analyze the text, determine the appropriate job type, and generate a helpful response message.

### GET /jobs/{job_id}
Get the current status and result of a job.

**Response:**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "type": "txt2img",
  "status": "completed",  // "pending", "processing", "completed", or "failed"
  "created_at": "2023-05-01T12:00:00.000Z",
  "updated_at": "2023-05-01T12:00:05.000Z",
  "result": [
    {
      "url": "/image/image_uuid.png",
      "prompt": "a beautiful landscape"
    }
  ],
  "error": null
}
```

### GET /image/{filename}
Retrieve a generated image by filename.

### POST /resize-image
Resize an uploaded image to specified dimensions or a predefined device format.

**Request Form Data:**
- `image`: The image file to resize
- `width`: (Optional) Target width in pixels
- `height`: (Optional) Target height in pixels
- `device`: (Optional) Device preset name (e.g., "iphone", "ipad", "desktop_hd")
- `maintain_aspect_ratio`: (Optional, default: True) Whether to preserve aspect ratio
- `fit_method`: (Optional, default: "fit") How to fit the image to dimensions:
  - `fit`: Scale to fit within dimensions, may leave empty space
  - `fill`: Scale to fill dimensions completely, may crop parts of image
  - `stretch`: Force to exact dimensions, may distort image
  - `pad`: Keep entire image visible and add padding to fill dimensions
- `output_format`: (Optional, default: "PNG") Output image format
- `background_color`: (Optional, default: "000000") Hex color for padding when using pad method

**Supported Device Presets:**
- `iphone`: iPhone 13/14 Pro (1170 × 2532)
- `iphone_plus`: iPhone 13/14 Pro Max (1284 × 2778)
- `iphone_se`: iPhone SE (750 × 1334)
- `ipad`: iPad Air (1640 × 2360)
- `ipad_pro`: iPad Pro 12.9 (2048 × 2732)
- `macbook`: MacBook Air 13" (1440 × 900)
- `macbook_pro`: MacBook Pro 14" (1800 × 1169)
- `desktop_hd`: HD Monitor (1920 × 1080)
- `desktop_4k`: 4K Monitor (3840 × 2160)
- `android`: Common Android (1080 × 2400)

**Response:**
```json
{
  "url": "/image/photo_resized_3fa85f64-5717-4562-b3fc-2c963f66afa6.png",
  "filename": "photo_resized_3fa85f64-5717-4562-b3fc-2c963f66afa6.png",
  "metadata": {
    "original_format": "JPEG",
    "original_dimensions": [4032, 3024],
    "resized_dimensions": [1170, 2532],
    "device": "iphone",
    "output_format": "PNG",
    "file_size_bytes": 1234567,
    "fit_method": "fill",
    "aspect_ratio": "Maintain"
  }
}
```

### POST /wallpaper/{device}
Create a wallpaper for a specific device by resizing an image. This is a specialized version of the resize endpoint specifically optimized for wallpapers.

**Path Parameters:**
- `device`: The target device (e.g., "iphone", "ipad", "desktop_hd")

**Request Form Data:**
- `image`: The image file to resize
- `fit_method`: (Optional, default: "fill") How to fit the image:
  - `fill`: Scale to fill dimensions completely, may crop parts of image
  - `pad`: Keep entire image visible and add padding to fill dimensions
  - `fit`: Scale to fit within dimensions, may leave empty space
  - `stretch`: Force to exact dimensions, may distort image
- `output_format`: (Optional, default: "PNG") Output image format
- `background_color`: (Optional, default: "000000") Hex color for padding when using pad method

**Response:**
Same as the resize-image endpoint.

## Commented Out Endpoints

The following endpoints are currently commented out in the code but can be uncommented for use:

### POST /txt2img
Generate an image from a text prompt.

### POST /img2img
Generate a new image based on an input image and a text prompt.

## Notes

This is a placeholder implementation. In a real implementation, you would integrate a text-to-image model like Stable Diffusion, DALL-E, or Midjourney.

The Groq API integration is used for two purposes:
1. Determining the type of request (txt, txt2img, or img2img)
2. Generating a helpful response message explaining how the request will be handled

## API Documentation

Once the server is running, you can access the automatically generated API documentation:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc` 