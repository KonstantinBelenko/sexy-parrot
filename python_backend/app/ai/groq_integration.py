"""
Integration with Groq API for prompt analysis and enhancement.
"""

import os
import json
import httpx
from typing import Dict, Any, Tuple
from ..logging import logger, StatusMarker
from ..models_lib import models_lib

# Groq API configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# GROQ_MODEL = "deepseek-r1-distill-llama-70b-specdec"
GROQ_MODEL = "qwen-qwq-32b"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

async def analyze_prompt_with_groq(prompt: str) -> Tuple[str, Dict[str, Dict[str, Any]]]:
    """
    Use Groq's AI to analyze and enhance a prompt, identifying potential LoRAs.
    
    Args:
        prompt: The user's raw text prompt
        
    Returns:
        Tuple of (enhanced_prompt, additional_networks)
            - enhanced_prompt: Improved version of the input prompt
            - additional_networks: Dictionary of suggested LoRAs to use
    """
    logger.info(f"{StatusMarker.PROMPT} Analyzing prompt: '{prompt[:50]}{'...' if len(prompt) > 50 else ''}'")
    
    # Prepare system message with LoRA information
    system_prompt = """
    You are an expert in analyzing and enhancing image generation prompts for Stable Diffusion.
    
    Your task is to:
    1. Analyze the user's prompt
    2. Enhance the prompt with more details in the proper format for Stable Diffusion
    3. Identify which of our available LoRAs (style modifiers) would be appropriate to use
    
    STABLE DIFFUSION PROMPT FORMAT GUIDELINES:
    - Format the prompt as a detailed, comma-separated list of descriptive words and phrases
    - Arrange elements chronologically with the most important elements at the beginning
    - Use parentheses () to increase emphasis on important features (1.1x weight)
    - Use double parentheses (()) for even stronger emphasis on critical elements (1.21x weight)
    - If using LoRAs, include their specific trigger words near the beginning of the prompt
    - Add quality boosters like "high quality", "detailed", "8k", "photorealistic" as appropriate
    - Be specific and detailed, breaking down general concepts into specific visual elements
    - Include materials, lighting, mood, and color information when relevant
    
    AVAILABLE LORAS:
    """
    
    # Add LoRAs to the system prompt
    for lora_name, lora_info in models_lib["loras"].items():
        trigger_words = lora_info.get("trigger_words", [])
        trigger_words_text = ", ".join([f'"{word}"' for word in trigger_words])
        system_prompt += f"- {lora_name}: Best for {lora_info.get('base_model', 'any model')}. Trigger words: {trigger_words_text}\n"
    
    system_prompt += """
    RESPONSE FORMAT:
    You must respond in JSON format with the following structure:
    {
      "loras": {
        "<air>": {
          "type": "Lora",
          "strength": 0.75
        }
      },
      "enhanced_prompt": "detailed, comma-separated, prompt, with (emphasis) on important, elements"
    }
    
    AVAILABLE LORAS: $LORAS
    
    EXAMPLE PROMPT STRUCTURES:
    Original: "a fantasy castle"
    Enhanced: "((fantasy castle)), (massive stone towers), ornate architecture, detailed stonework, dramatic lighting, epic scale, medieval fantasy, moat, drawbridge, flying banners, 8k, hyperrealistic"
    
    Original: "a girl in watercolor style"
    Enhanced: "((watercolor painting)), (beautiful young woman), (delicate features), flowing colors, soft brushstrokes, artistic composition, vibrant palette, detailed portrait, paint splatters, color bleeding effect, professional artwork"
    
    Original: "futuristic city"
    Enhanced: "((futuristic metropolis)), (cyberpunk cityscape), (neon lights), towering skyscrapers, flying vehicles, holographic advertisements, rainy night, reflective surfaces, detailed architecture, sci-fi atmosphere, 8k, hyperdetailed"
    
    Only include LoRAs that truly match the prompt's style or content. If no appropriate LoRAs, return an empty object {}.
    The strength should be between 0.5 (subtle effect) and 1.0 (strong effect) depending on how central the style is to the prompt.
    """
    
    # Add LoRAs to the system prompt
    available_loras = ""
    for lora_name, lora_info in models_lib["loras"].items():
        available_loras += f"- {lora_name}: Best for {lora_info.get('base_model', 'any model')}. Trigger words: {lora_info.get('trigger_words', [])}. Examples: {lora_info.get('examples', [])}\n"
    system_prompt = system_prompt.replace("$LORAS", available_loras)
    
    try:
        # Call Groq API
        logger.info(f"{StatusMarker.MODEL} Calling Groq with model: {GROQ_MODEL}")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Analyze and enhance this image generation prompt: '{prompt}'"}
                    ],
                    "max_tokens": 1024,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"}
                },
                timeout=30.0
            )
            
            # Parse response
            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                data = json.loads(content)
                
                enhanced_prompt = data.get("enhanced_prompt", prompt)
                loras = data.get("loras", {})
                
                # Log a shorter version of the enhanced prompt
                short_prompt = enhanced_prompt[:75] + ('...' if len(enhanced_prompt) > 75 else '')
                logger.info(f"{StatusMarker.PROMPT} Enhanced: '{short_prompt}'")
                
                # Use loras directly if they're in the right format (dictionary with URNs as keys)
                # or convert lora names to URNs if needed
                additional_networks = {}
                
                if isinstance(loras, dict):
                    for lora_key, lora_config in loras.items():
                        # Skip if config isn't valid
                        if not isinstance(lora_config, dict):
                            continue
                            
                        # Check if the key is a valid URN or a lora name
                        if "air:sd1:lora" in lora_key:
                            # Already a URN, use it directly
                            lora_urn = lora_key
                            additional_networks[lora_urn] = {
                                "type": lora_config.get("type", "Lora"),
                                "strength": lora_config.get("strength", 0.75)
                            }
                            # Extract name from URN for logging
                            lora_name = lora_urn.split(":")[-1].split("@")[0]
                            logger.info(f"{StatusMarker.LORA} Added URN '{lora_name}' (strength: {lora_config.get('strength', 0.75):.2f})")
                        elif lora_key in models_lib["loras"]:
                            # It's a lora name, convert to URN
                            lora_name = lora_key
                            lora_urn = models_lib["loras"][lora_name]["air"]
                            additional_networks[lora_urn] = {
                                "type": lora_config.get("type", "Lora"),
                                "strength": lora_config.get("strength", 0.75)
                            }
                            logger.info(f"{StatusMarker.LORA} Converted name '{lora_name}' to URN (strength: {lora_config.get('strength', 0.75):.2f})")
                        else:
                            # Unknown lora, log warning
                            logger.warning(f"{StatusMarker.LORA} Unknown LoRA key: '{lora_key}', skipping")
                
                if not additional_networks:
                    logger.info(f"{StatusMarker.LORA} No LoRAs selected for this prompt")
                else:
                    logger.info(f"{StatusMarker.LORA} Selected {len(additional_networks)} LoRA(s)")
                
                return enhanced_prompt, additional_networks
            else:
                logger.error(f"{StatusMarker.ERROR} Groq API error: {response.status_code}")
                return prompt, {}  # Return original prompt and empty dict on error
                
    except Exception as e:
        logger.error(f"{StatusMarker.ERROR} Prompt analysis failed: {str(e)}")
        return prompt, {}  # Return original prompt and empty dict on error 