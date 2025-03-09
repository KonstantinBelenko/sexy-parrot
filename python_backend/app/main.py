"""
Main application entry point for the Text to Image API.
This file integrates the modular components and initializes the FastAPI app.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load environment variables first, before importing dependencies
load_dotenv()

# Import logger
from .logging import logger, StatusMarker

# Get Civitai API token from environment and set it directly
CIVITAI_API_TOKEN = os.getenv("CIVITAI_API_TOKEN")
if CIVITAI_API_TOKEN:
    os.environ["CIVITAI_API_TOKEN"] = CIVITAI_API_TOKEN
    logger.info(f"Loaded Civitai API token: {CIVITAI_API_TOKEN[:5]}...{CIVITAI_API_TOKEN[-5:]}")
else:
    logger.warning("CIVITAI_API_TOKEN not found in environment variables")

# Import civitai SDK - must be imported after setting CIVITAI_API_TOKEN
import civitai

# Create FastAPI app
app = FastAPI(title="Text to Image API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories for storing files
os.makedirs("output", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
os.makedirs("jobs", exist_ok=True)

# Import router components
from .routes.image import router as image_router  # Updated to use the new modular image routes
from .routes.interpretation import router as interpretation_router
from .routes.jobs import router as jobs_router

# Include the routers
app.include_router(image_router)
app.include_router(interpretation_router)
app.include_router(jobs_router)

@app.get("/")
async def root():
    return {"message": "Text to Image API is running"} 