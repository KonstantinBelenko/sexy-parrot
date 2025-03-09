"""
Shared storage for job tracking.

This module provides a centralized storage for job data.
In a production environment, this would be replaced by a database.
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Global jobs dictionary
jobs: Dict[str, Dict[str, Any]] = {}

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a job by ID, either from memory or from the filesystem.
    
    Args:
        job_id: The ID of the job to retrieve
        
    Returns:
        The job data as a dictionary, or None if not found
    """
    # First check in-memory jobs dictionary
    if job_id in jobs:
        return jobs[job_id]
    
    # If not in memory, try to load from file
    job_path = f"jobs/{job_id}.json"
    if os.path.exists(job_path):
        with open(job_path, "r") as f:
            job_data = json.load(f)
            # Cache back in memory
            jobs[job_id] = job_data
            return job_data
    
    # Job not found
    return None

def create_job(job_id: str, job_type: str, text: str, images: list = None) -> Dict[str, Any]:
    """
    Create a new job and persist it.
    
    Args:
        job_id: Unique identifier for the job
        job_type: Type of job (txt, txt2img, img2img)
        text: User text associated with the job
        images: Optional list of image data
        
    Returns:
        The created job data
    """
    job_data = {
        "id": job_id,
        "type": job_type,
        "status": "pending",
        "text": text,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "images": [img["filename"] for img in images] if images else []
    }
    
    # Store in memory
    jobs[job_id] = job_data
    
    # Save to file
    with open(f"jobs/{job_id}.json", "w") as f:
        json.dump(job_data, f)
    
    return job_data

def update_job(job_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an existing job.
    
    Args:
        job_id: ID of the job to update
        updates: Dictionary of fields to update
        
    Returns:
        The updated job data, or None if job not found
    """
    job = get_job(job_id)
    if not job:
        return None
    
    # Update job fields
    job.update(updates)
    job["updated_at"] = datetime.now().isoformat()
    
    # Save back to memory and file
    jobs[job_id] = job
    with open(f"jobs/{job_id}.json", "w") as f:
        json.dump(job, f)
    
    return job

def set_job_failed(job_id: str, error: str) -> None:
    """
    Mark a job as failed with an error message.
    
    Args:
        job_id: ID of the job to mark as failed
        error: Error message describing the failure
    """
    if job_id in jobs:
        update_job(job_id, {
            "status": "failed",
            "error": error
        }) 