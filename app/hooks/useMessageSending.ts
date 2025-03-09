'use client'

import { useState, useEffect, useRef } from "react";
import { Message, MessageType } from "../types";
import { useImageGeneration } from "./useImageGeneration";

type SendHandlers = {
  setMessages: (value: React.SetStateAction<Message[]>) => void;
  setInputText: (value: React.SetStateAction<string>) => void;
  setFiles: (value: React.SetStateAction<File[]>) => void;
  setInputPosition: (value: React.SetStateAction<"center" | "bottom">) => void;
  setMessagesSent: (value: React.SetStateAction<number>) => void;
  setIsSending: (value: React.SetStateAction<boolean>) => void;
  setError: (value: React.SetStateAction<string | null>) => void;
  simulateTyping: (text: string, messageId: string, onComplete?: () => void) => void;
  messagesSent: number;
};

export const useMessageSending = (handlers: SendHandlers) => {
  const { 
    setMessages, 
    setInputText, 
    setFiles, 
    setInputPosition, 
    setMessagesSent, 
    setIsSending, 
    setError,
    simulateTyping,
    messagesSent
  } = handlers;
  
  const { generateImages, remixImage, progressPercentage } = useImageGeneration();
  const currentGenImageId = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  
  // Keep messagesRef in sync
  useEffect(() => {
    setMessages(prev => {
      messagesRef.current = prev;
      return prev;
    });
  }, [setMessages]);
  
  // Update the message with the current progress
  useEffect(() => {
    if (currentGenImageId.current) {
      const currentId = currentGenImageId.current;
      setMessages(prev => 
        prev.map(msg => 
          msg.id === currentId
            ? { ...msg, progressPercentage }
            : msg
        )
      );
    }
  }, [progressPercentage, setMessages]);
  
  // Function to handle re-running a previous user message
  const handleRerunMessage = (messageContent: string, messageId: string, files?: File[]) => {
    // Find the index of the user message in the messages array
    const messageIndex = messagesRef.current.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return; // Message not found
    
    // Remove all messages that came after this user message (the AI responses)
    const updatedMessages = messagesRef.current.filter((_, index) => index <= messageIndex);
    
    // Add a loading message
    const loadingId = `loading-${Date.now()}`;
    const loadingMessage = {
      id: loadingId,
      content: "Thinking...",
      type: "loading" as MessageType,
      isUser: false
    };
    
    const newMessages = [...updatedMessages, loadingMessage];
    setMessages(() => newMessages);
    messagesRef.current = newMessages;
    
    // Run the request asynchronously
    (async () => {
      try {
        // Set sending state
        setIsSending(true);
        
        // Call the interpret endpoint
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
        // Create FormData to send both text and images
        const formData = new FormData();
        formData.append('text', messageContent);
        
        // Add all image files if they exist
        if (files && files.length > 0) {
          files.forEach(file => {
            formData.append('images', file);
          });
        }
        
        // Add message history
        const history = updatedMessages.map(msg => ({
          content: msg.content,
          isUser: msg.isUser,
          type: msg.type
        }));
        formData.append('history', JSON.stringify(history));
        console.log('Chat history:', JSON.stringify(history, null, 2));
        
        const response = await fetch(`${apiUrl}/interpret`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Print the full response to console for debugging
        console.log("Interpret endpoint response (rerun):", data);
        
        // Remove loading message
        setMessages(prev => prev.filter(msg => msg.id !== loadingId));
        
        // Process the response based on the type
        if (data.type === "txt") {
          // For text responses, only show typing animation first
          const aiMessageId = `ai-${Date.now()}`;
          simulateTyping(data.response_text, aiMessageId);
        } else if (data.type === "txt2img") {
          // Get number of images to generate (default to 1 if not specified)
          const numImages = data.num_images || data.number_of_images || 1;
          
          // Show an initial response message with typing animation instead of instant text
          const aiMessageId = `ai-reply-${Date.now()}`;
          simulateTyping(data.response_text, aiMessageId, () => {
            // Only start image generation after text animation completes
            // Add a message with generating-image type to show the loading state
            const genImageId = `gen-image-${Date.now()}`;
            currentGenImageId.current = genImageId;
            setMessages(prev => [
              ...prev,
              {
                id: genImageId,
                content: "",
                type: "generating-image" as MessageType,
                numImages: numImages,
                progressPercentage: 0,
                isUser: false
              }
            ]);
            
            // Generate the images - always use the original user message content
            generateImages(
              messageContent, 
              numImages
            )
              .then(result => {
                // Replace the generating-image message with the actual images
                if (currentGenImageId.current) {
                  // Check if prompt was enhanced
                  const promptEnhanced = result.generationData?.prompt_enhanced;
                  const originalPrompt = result.generationData?.original_prompt;
                  const savedGenImageId = currentGenImageId.current; // Save for comparison
                  
                  // Create a message about enhancements if relevant
                  let enhancementInfo = '';
                  if (promptEnhanced) {
                    enhancementInfo = ' (prompt enhanced for better results)';
                  }
                  
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === savedGenImageId
                        ? {
                            ...msg,
                            content: `Generated images${enhancementInfo}:`,
                            type: "generated-image" as MessageType,
                            imageUrls: result.imageUrls,
                            generationData: result.generationData,
                          }
                        : msg
                    )
                  );
                  
                  // If prompt was enhanced, add a system message showing the enhanced prompt
                  if (promptEnhanced && originalPrompt) {
                    setMessages(prev => [
                      ...prev,
                      {
                        id: `system-enhanced-${Date.now()}`,
                        content: `Your prompt was enhanced for better results:\nOriginal: "${originalPrompt}"\nEnhanced: "${result.generationData.prompt}"`,
                        type: "text" as MessageType,
                        isUser: false,
                        isSystemMessage: true
                      }
                    ]);
                  }
                  
                  currentGenImageId.current = null;
                }
              })
              .catch(genError => {
                // Handle image generation errors
                currentGenImageId.current = null;
                console.error("Image generation error:", genError);
                setError(`Failed to generate image: ${genError instanceof Error ? genError.message : String(genError)}`);
                
                // Remove the generating image message on error
                setMessages(prev => prev.filter(msg => msg.id !== genImageId));
              });
          });
        } else if (data.type === "img2img") {
          // Just show the text response for now
          setMessages(prev => [
            ...prev, 
            {
              id: `ai-${Date.now()}`,
              content: data.response_text,
              type: "text" as MessageType,
              isUser: false
            }
          ]);
        }
      } catch (error) {
        console.error("Error resending message:", error);
        setError(`Failed to interpret message: ${error instanceof Error ? error.message : String(error)}`);
        
        // Remove loading message
        setMessages(prev => prev.filter(msg => msg.id !== loadingId));
      } finally {
        setIsSending(false);
      }
    })();
  };
  
  const handleSend = async (inputText: string, files: File[]) => {
    if (!inputText.trim()) return;
    
    // Store the text to be sent before clearing the input
    const textToSend = inputText;
    
    // Clear input and files instantly for better UX
    setInputText("");
    setFiles([]);
    
    const messageId = Date.now().toString();
    
    // Add user message to the list
    const newMessage = {
      id: messageId,
      content: textToSend,
      type: "text" as MessageType,
      isUser: true
    };
    
    setMessages(prev => [...prev, newMessage]);
    messagesRef.current = [...messagesRef.current, newMessage];
    
    // Move input to bottom after first message
    if (messagesSent === 0) {
      setInputPosition("bottom");
    }
    
    // Add loading message
    const loadingId = `loading-${messageId}`;
    const loadingMessage = {
      id: loadingId,
      content: "Thinking...",
      type: "loading" as MessageType,
      isUser: false
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    messagesRef.current = [...messagesRef.current, loadingMessage];
    
    try {
      // Set sending state
      setIsSending(true);
      
      // Call the interpret endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      // Create FormData to send text and history
      const formData = new FormData();
      formData.append('text', textToSend);
      
      // Add message history
      const history = messagesRef.current.map(msg => ({
        content: msg.content,
        isUser: msg.isUser,
        type: msg.type
      }));
      formData.append('history', JSON.stringify(history));
      console.log('Chat history:', JSON.stringify(history, null, 2));
      
      const response = await fetch(`${apiUrl}/interpret`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Print the full response to console for debugging
      console.log("Interpret endpoint response:", data);
      
      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingId));
      
      // Show typing animation for the response
      const aiMessageId = `ai-${Date.now()}`;
      simulateTyping(data.response, aiMessageId);
      
      // Increment messages sent counter
      setMessagesSent(prev => prev + 1);
      
    } catch (error) {
      console.error("Error sending message:", error);
      setError(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
      
      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingId));
    } finally {
      setIsSending(false);
    }
  };
  
  // Function to handle remixing an image
  const handleRemixImage = (generationData: any, imageIndex?: number, totalImages?: number) => {
    // Add a user message indicating which image is being remixed
    const userMessageId = `user-remix-${Date.now()}`;
    let remixMessage = "Remix this image";
    
    // If we have index information, add it to the message
    if (typeof imageIndex === 'number' && typeof totalImages === 'number') {
      // Convert index to ordinal position (1st, 2nd, 3rd, etc.)
      const position = imageIndex + 1;
      const getOrdinal = (n: number) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };
      
      remixMessage = `Remix the ${getOrdinal(position)} image`;
      if (totalImages > 1) {
        remixMessage += ` of ${totalImages}`;
      }
    }
    
    // Add user message
    setMessages(prev => [
      ...prev,
      {
        id: userMessageId,
        content: remixMessage,
        type: "text" as MessageType,
        isUser: true
      }
    ]);
    
    // Add a loading message for the remix
    const genImageId = `gen-remix-${Date.now()}`;
    currentGenImageId.current = genImageId;
    
    // Add a message to show the remixing progress
    setMessages(prev => [
      ...prev,
      {
        id: genImageId,
        content: "Remixing image...",
        type: "generating-image" as MessageType,
        numImages: 4, // Always generate 4 variations
        progressPercentage: 0,
        isUser: false
      }
    ]);
    
    // Call the remix function
    remixImage(generationData)
      .then(result => {
        // Replace the generating-image message with the actual images
        // currentGenImageId.current = null;  // DON'T clear this yet, we need it below
        
        // Check if this is a placeholder result
        const isPlaceholder = result.generationData?.note?.includes("placeholder");
        const hasEnhancedPrompt = result.generationData?.prompt !== result.generationData?.original_prompt;
        const additionalLoras = result.generationData?.additional_loras || {};
        const hasAdditionalLoras = Object.keys(additionalLoras).length > 0;
        
        // Build a descriptive message about what was enhanced
        let enhancementMessage = '';
        if (hasEnhancedPrompt) {
          enhancementMessage = 'Prompt was enhanced for better results. ';
        }
        if (hasAdditionalLoras) {
          enhancementMessage += `${Object.keys(additionalLoras).length} additional LoRAs were suggested. `;
        }
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === genImageId
              ? {
                  ...msg,
                  content: isPlaceholder 
                    ? `Remixed variations${enhancementMessage ? ` (${enhancementMessage.trim()})` : ''}:` 
                    : "Remixed variations:",
                  type: "generated-image" as MessageType,
                  imageUrls: result.imageUrls,
                  generationData: result.generationData,
                }
              : msg
          )
        );
        
        // Only now clear the currentGenImageId
        currentGenImageId.current = null;
        
        // If this is a placeholder and we have an enhanced prompt, add a system message explaining
        if (isPlaceholder && (hasEnhancedPrompt || hasAdditionalLoras)) {
          let promptMessage = '';
          if (hasEnhancedPrompt) {
            promptMessage = `Enhanced prompt: "${result.generationData.prompt}"\n\n`;
          }
          
          let lorasMessage = '';
          if (hasAdditionalLoras) {
            lorasMessage = 'Suggested LoRAs:\n';
            Object.entries(additionalLoras).forEach(([key, value]: [string, any]) => {
              lorasMessage += `- ${key.split(':').pop()} (strength: ${value.strength})\n`;
            });
          }
          
          setMessages(prev => [
            ...prev,
            {
              id: `system-placeholder-${Date.now()}`,
              content: `${promptMessage}${lorasMessage}\n${result.generationData.note || "Note: These are placeholder variations. Full AI remixing coming soon."}`,
              type: "text" as MessageType,
              isUser: false,
              isSystemMessage: true
            }
          ]);
        }
      })
      .catch(error => {
        // Handle remix errors
        currentGenImageId.current = null;
        console.error("Image remix error:", error);
        setError(`Failed to remix image: ${error instanceof Error ? error.message : String(error)}`);
        
        // Remove the generating image message on error
        setMessages(prev => prev.filter(msg => msg.id !== genImageId));
      });
  };
  
  // Function to handle upscaling an image
  const handleUpscaleImage = (imageUrl: string, imageIndex?: number) => {
    // Add a user message indicating which image is being upscaled
    const userMessageId = `user-upscale-${Date.now()}`;
    let upscaleMessage = "Upscale this image";
    
    // If we have index information, add it to the message
    if (typeof imageIndex === 'number') {
      // Convert index to ordinal position (1st, 2nd, 3rd, etc.)
      const position = imageIndex + 1;
      const getOrdinal = (n: number) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };
      
      upscaleMessage = `Upscale the ${getOrdinal(position)} image`;
    }
    
    // Add user message
    setMessages(prev => [
      ...prev,
      {
        id: userMessageId,
        content: upscaleMessage,
        type: "text" as MessageType,
        isUser: true
      }
    ]);
    
    // Add a loading message for the upscale
    const upscaleImageId = `upscale-${Date.now()}`;
    currentGenImageId.current = upscaleImageId;
    
    // Add a message to show the upscaling progress
    setMessages(prev => [
      ...prev,
      {
        id: upscaleImageId,
        content: "Upscaling image...",
        type: "generating-image" as MessageType,
        numImages: 1, // Only upscale to 1 image
        progressPercentage: 0,
        isUser: false
      }
    ]);
    
    // Extract filename to pass to the API
    const filename = imageUrl.split('/').pop();
    
    if (!filename) {
      setError("Could not extract filename from image URL");
      return;
    }
    
    // Set up API call
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const upscaleUrl = `${apiUrl}/upscale-image/${encodeURIComponent(filename)}`;
    
    // Set loading state
    setIsSending(true);
    
    // Perform the upscale request
    fetch(upscaleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        scale_factor: 2.0,
        upscaler: "4x-UltraSharp",
        denoise_strength: 0.4,
        enhance_faces: true,
        preserve_original_size: false
      }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Replace the generating message with the upscaled image
        const savedUpscaleId = upscaleImageId; // Save the ID for use in comparison
        currentGenImageId.current = null;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === savedUpscaleId
              ? {
                  ...msg,
                  content: "Upscaled image:",
                  type: "generated-image" as MessageType,
                  imageUrls: [data.url],
                  metadata: {
                    width: data.width,
                    height: data.height,
                    original_dimensions: [data.original_width, data.original_height],
                    resized_dimensions: [data.width, data.height],
                    scale_factor: data.scale_factor,
                    upscaler: data.upscaler
                  }
                }
              : msg
          )
        );
      })
      .catch(error => {
        // Handle upscale errors
        currentGenImageId.current = null;
        console.error("Image upscale error:", error);
        setError(`Failed to upscale image: ${error instanceof Error ? error.message : String(error)}`);
        
        // Remove the loading message on error
        setMessages(prev => prev.filter(msg => msg.id !== upscaleImageId));
      })
      .finally(() => {
        setIsSending(false);
      });
  };
  
  return {
    handleRerunMessage,
    handleSend,
    handleRemixImage,
    handleUpscaleImage
  };
}; 