"""
Schemas for job tracking and status reporting.
"""

from pydantic import BaseModel
from typing import Optional, Any

class JobStatus(BaseModel):
    """Job status model for tracking asynchronous tasks."""
    id: str
    type: str
    status: str  # "pending", "processing", "completed", "failed"
    created_at: str
    updated_at: str
    result: Optional[Any] = None
    error: Optional[str] = None 