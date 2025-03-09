"""
Schemas for text interpretation requests and responses.
"""

from pydantic import BaseModel

class InterpretRequest(BaseModel):
    """Request model for interpreting user input."""
    text: str

class InterpretResponse(BaseModel):
    """Response model for interpretation results."""
    response: str 