models_lib = {
    "base_models": {
        "SD 1.5": {
            "air": "urn:air:sd1:checkpoint:civitai:15003@1460987",
            "type": "checkpoint",
            "url": "https://civitai.com/models/15003/cyberrealistic?modelVersionId=1460987",
            "style": "realistic"
        },
        "Prefect illustrious XL": {
            "air": "urn:air:sdxl:checkpoint:civitai:1224788@1379960",
            "type": "checkpoint",
            "url": "https://civitai.com/models/1224788/prefect-illustrious-xl",
            "style": "realistic"
        }
    },

    "loras": {
        "watercolor": {
            "air": "urn:air:sd1:lora:civitai:105784@113556",
            "type": "lora",
            "base_model": "SD 1.5",
            "trigger_words": [ "watercolor" ],
            "url": "https://civitai.com/models/105784/watercolor-or",
        },
        "neeko": {
            "air": "urn:air:sd1:lora:civitai:52525@56990",
            "type": "lora",
            "base_model": "SD 1.5",
            "trigger_words": [ "neeko", "facial marks, hair ornaments, hair flower, necklace, brown shorts, crop top, lizard tail" ],
            "url": "https://civitai.com/models/52525/neeko-league-of-legends-lora",
            "examples": [
                {
                    "prompt": "masterpiece, best quality, <lora:novowels_neeko:0.95>, 1girl, solo, neeko, facial marks, hair ornaments, hair flower, necklace, brown shorts, crop top, lizard tail, puffy lips, upper body, closeup portrait, looking at viewer, pov, outdoors, scenic view, amazing, official art, professional illustration, hires",
                    "negative_prompt": "FastNegativeV2, bad_prompt, badhandv4, easynegative, negative_hand, ng_deepnegative_v1_75t, verybadimagenegative_v1.3, lowres, ugly, worst quality, low quality, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, jpeg artifacts, signature, watermark, username, blurry, bad feet, poorly drawn hands, poorly drawn face, mutation, deformed, extra fingers, extra limbs, missing limbs, extra legs, extra arms, malformed limbs, long neck, extra feet",
                    "guidance": 7,
                    "steps": 40,
                    "sampler": "DPM++ 2M Karras",
                    "clip_skip": 2,
                }
            ]
        }
    }
}