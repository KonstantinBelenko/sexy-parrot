"""
API endpoints for job tracking and management.
"""

from fastapi import APIRouter, HTTPException

from ..schemas.jobs import JobStatus
from ..logging import logger, StatusMarker
from ..utils.jobs_storage import get_job

router = APIRouter(tags=["jobs"])

@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get the status of a specific job"""
    try:
        job_data = get_job(job_id)
        
        if not job_data:
            raise HTTPException(status_code=404, detail="Job not found")
            
        return job_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"{StatusMarker.ERROR} Error retrieving job: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving job: {str(e)}") 