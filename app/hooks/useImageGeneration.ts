'use client'

import { useState } from "react";

export const useImageGeneration = () => {
  const [generatingImage, setGeneratingImage] = useState(false);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const selectedModel = "Prefect illustrious XL";
  
  // Function to generate images using Civitai with selected model
  const generateImages = async (prompt: string, numImages: number = 1): Promise<{imageUrls: string[], generationData: any}> => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    setGeneratingImage(true);
    setProgressPercentage(0);
    
    // Start the progress bar animation
    const progressInterval = setInterval(() => {
      setProgressPercentage(prev => {
        // Cap at 95% until the actual generation completes
        return prev < 95 ? prev + (95 / 40) : prev;
      });
    }, 1000); // Update every second to complete in roughly 40 seconds
    
    try {
      // Always use SD 1.5 model
      const modelURN = "urn:air:sd1:checkpoint:civitai:15003@1460987";
      
      // Prepare request data
      const requestData = {
        prompt: prompt,
        negative_prompt: "blurry, bad quality, deformed, disfigured, lowres, low resolution",
        model: selectedModel, 
        model_urn: modelURN,
        width: 512,
        height: 512,
        num_inference_steps: 30,
        guidance_scale: 7.5,
        num_images: numImages
      };
      
      console.log("Generating images with model:", selectedModel);
      
      // Call the backend to generate image
      const response = await fetch(`${apiUrl}/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        throw new Error(`Image generation failed: ${response.status}`);
      }
      
      const data = await response.json();

      // Log the complete generation data including LoRAs and prompts
      console.log("Image generation complete with:", {
        prompt: data.generation_data?.prompt || prompt,
        negative_prompt: data.generation_data?.negative_prompt || requestData.negative_prompt,
        loras: data.generation_data?.loras || {},
        model: data.generation_data?.model || selectedModel,
        original_prompt: data.generation_data?.original_prompt,
        prompt_enhanced: data.generation_data?.prompt_enhanced
      });
      
      // Set to 100% when done
      setProgressPercentage(100);
      
      // Return both the image URLs and the generation data
      return {
        imageUrls: data.image_urls,
        generationData: {
          prompt: data.generation_data?.prompt || prompt,
          negative_prompt: data.generation_data?.negative_prompt || requestData.negative_prompt,
          loras: data.generation_data?.loras || {},
          model: data.generation_data?.model || selectedModel,
          original_prompt: data.generation_data?.original_prompt,
          prompt_enhanced: data.generation_data?.prompt_enhanced
        }
      };
    } finally {
      clearInterval(progressInterval);
      setGeneratingImage(false);
    }
  };

  // Function to remix an existing image by creating variations
  const remixImage = async (generationData: any): Promise<{imageUrls: string[], generationData: any}> => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    setGeneratingImage(true);
    setProgressPercentage(0);
    
    // Start the progress bar animation - same as generateImages
    const progressInterval = setInterval(() => {
      setProgressPercentage(prev => {
        // Cap at 95% until the actual generation completes
        return prev < 95 ? prev + (95 / 40) : prev;
      });
    }, 1000);
    
    try {
      if (!generationData.imageUrl) {
        throw new Error('Image URL is required for remixing');
      }
      
      // Prepare request data using the original generation data
      const requestData = {
        image_url: generationData.imageUrl, // Add the image URL
        prompt: generationData.prompt,
        negative_prompt: generationData.negative_prompt,
        model: generationData.model || selectedModel,
        model_urn: generationData.model_urn || "", // Use the model_urn from generation data
        additional_networks: generationData.loras || {},
        width: 512,
        height: 512,
        num_inference_steps: 30,
        guidance_scale: 7.5,
        strength: generationData.strength || 0.7, // Add strength parameter (default 0.7)
        num_images: 4 // Always generate 4 variations
      };
      
      console.log("Remixing image with data:", requestData);
      
      // Call the backend remix endpoint
      const response = await fetch(`${apiUrl}/remix-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        throw new Error(`Image remix failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Log the complete remix data
      console.log("Image remix complete with:", {
        prompt: generationData.prompt,
        negative_prompt: generationData.negative_prompt,
        loras: generationData.loras || {},
        model: generationData.model || selectedModel,
        variations: data.image_urls.length
      });
      
      // Set to 100% when done
      setProgressPercentage(100);
      
      // Return both the image URLs and the original generation data
      return {
        imageUrls: data.image_urls,
        generationData: generationData
      };
    } finally {
      clearInterval(progressInterval);
      setGeneratingImage(false);
    }
  };

  return {
    generatingImage,
    progressPercentage,
    generateImages,
    remixImage,
    selectedModel
  };
}; 