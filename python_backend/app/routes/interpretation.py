"""
API endpoints for text interpretation.
"""

import json
import httpx
from fastapi import APIRouter, HTTPException, Form
from typing import Dict

from ..logging import logger, StatusMarker
from ..ai.groq_integration import GROQ_API_KEY, GROQ_MODEL, GROQ_API_URL
from ..schemas.interpretation import InterpretResponse

router = APIRouter(tags=["interpretation"])

@router.post("/interpret", response_model=InterpretResponse)
async def interpret_text(text: str = Form(...), history: str = Form(None)) -> Dict[str, str]:
    """
    Process text input using Groq API and return a response.
    """
    try:
        # Parse history if provided
        messages = []
        if history:
            try:
                history_data = json.loads(history)
                messages = [
                    {"role": "assistant" if not msg["isUser"] else "user", 
                     "content": msg["content"]} 
                    for msg in history_data
                ]
                print('messages', messages)
            except json.JSONDecodeError:
                logger.warning("Failed to parse message history")
        
        # Create a system prompt for Groq
        system_prompt = """
        Don't worry about formalities.
        Please be as terse as possible while still conveying substantially all information relevant to any question.
        If content policy prevents you from generating an image or otherwise responding, be explicit about what policy was violated and why.    
                
        Please don't use too many words as to not to overwhelm the user. `Consider that you're talking to a student who might be clueless.
        
        IMPORTANT: You must respond in JSON format with the following structure:
        {
          "response": "Your helpful response to the user's query"
        }
        """
        
        # Build messages array with history
        all_messages = [{"role": "system", "content": f"\n\n{system_prompt}"}]
        all_messages.extend(messages)
        all_messages.append({"role": "user", "content": text})
        
        # Call Groq API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": all_messages,
                    "max_tokens": 1500,
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"}
                },
                timeout=30.0
            )
            
            print(response.status_code, response)

            if response.status_code != 200:
                print(response.text)
                raise HTTPException(status_code=500, detail="Failed to get response from Groq API")
            
            # Parse the response
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # If content is already a dict, use it directly
            if isinstance(content, dict):
                return content
            
            # Otherwise parse the JSON string
            return json.loads(content)
            
    except Exception as e:
        logger.error(f"{StatusMarker.ERROR} Failed to process request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process request: {str(e)}") 