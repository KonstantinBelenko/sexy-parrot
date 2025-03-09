"""
Utility functions for LoRA detection and handling.
"""

from typing import Dict, Any
from ..logging import logger, StatusMarker
from ..models_lib import models_lib

def identify_loras_in_prompt(prompt: str) -> Dict[str, Dict[str, Any]]:
    """
    Analyze a prompt to identify potential LoRAs to use in image generation.
    
    Args:
        prompt: The text prompt to analyze
        
    Returns:
        Dictionary of LoRA configurations to pass to the API
    """
    loras = {}
    
    # Get all available loras from models_lib
    available_loras = models_lib.get("loras", {})
    
    # Look for trigger words in the prompt
    for lora_name, lora_info in available_loras.items():
        trigger_words = lora_info.get("trigger_words", [])
        
        # Check if any trigger words are in the prompt
        if any(trigger_word.lower() in prompt.lower() for trigger_word in trigger_words):
            # Add this LoRA to the dictionary
            lora_urn = lora_info["air"]
            loras[lora_urn] = {
                "type": "Lora",
                "strength": 0.75  # Default strength
            }
            logger.info(f"{StatusMarker.LORA} Found LoRA '{lora_name}' in prompt based on trigger words: {trigger_words}")
    
    return loras 