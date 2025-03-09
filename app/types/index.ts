/* eslint-disable */
// Define message types
export type MessageType = 'text' | 'loading' | 'image' | 'generating-image' | 'generated-image' | 'typing';

export interface Message {
  id: string;
  content: string;
  type: MessageType;
  files?: File[];
  imageUrl?: string; // Single image URL
  imageUrls?: string[]; // Multiple image URLs
  numImages?: number; // Number of images to generate
  progressPercentage?: number; // Progress percentage for generation
  isUser: boolean;
  isEditing?: boolean; // Flag to indicate if the message is being edited
  // Add new fields for image generation metadata
  generationData?: {
    prompt: string;
    negative_prompt: string;
    loras?: Record<string, any>; // LoRA information
    model?: string;
  };
  // Metadata for resized images
  metadata?: {
    original_format?: string;
    original_dimensions?: [number, number];
    resized_dimensions?: [number, number];
    device?: string;
    output_format?: string;
    file_size_bytes?: number;
  };
} 