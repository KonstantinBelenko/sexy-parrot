'use client'

import { motion } from "framer-motion";
import { FC, useState } from "react";
import { Message } from "../types";
import { Button } from "@/components/ui/button";
import { Flame, ZoomIn } from "lucide-react";

interface ImageCardProps {
  url: string;
  index: number;
  totalImages: number;
  openImageViewer: (url: string, collection: string[], index: number) => void;
  generationData?: Message['generationData'];
  handleRemixImage?: (generationData: any, imageIndex?: number, totalImages?: number) => void;
  handleUpscaleImage?: (url: string, imageIndex?: number) => void;
}

const ImageCard: FC<ImageCardProps> = ({ 
  url, 
  index,
  totalImages,
  openImageViewer, 
  generationData,
  handleRemixImage,
  handleUpscaleImage
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleRemixClick = (e: React.MouseEvent) => {
    // Stop propagation to prevent opening the image viewer
    e.stopPropagation();

    // Only remix if we have generation data and a callback
    if (generationData && handleRemixImage) {
      // Include the image URL in the generation data
      const remixData = {
        ...generationData,
        imageUrl: url  // Add the current image URL
      };
      handleRemixImage(remixData, index, totalImages);
    }
  };
  
  const handleUpscaleClick = (e: React.MouseEvent) => {
    // Stop propagation to prevent opening the image viewer
    e.stopPropagation();
    
    // Only upscale if we have a callback
    if (handleUpscaleImage) {
      handleUpscaleImage(url, index);
    }
  };

  return (
    <motion.div
      className="relative cursor-pointer overflow-hidden rounded-md flex flex-col"
      initial={{ opacity: 0, rotateX: 10, y: -10, perspective: 1000 }}
      animate={{ 
        opacity: 1, 
        rotateX: 0, 
        y: 0,
        transition: {
          delay: index * 0.1, // Stagger the animations
        }
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        duration: 0.3
      }}
      onClick={() => {
        // Create array of all images in this collection
        const imageUrls = Array(totalImages).fill(null).map((_, i) => url);
        openImageViewer(url, imageUrls, index);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={url}
        alt={`AI Generated Image ${index + 1}`}
        className="w-full h-full object-cover rounded-md transition-transform duration-200"
        loading="lazy"
      />
      
      {/* Overlay with buttons - shown on hover */}
      <div 
        className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {handleRemixImage && generationData && (
          <Button 
            onClick={handleRemixClick}
            variant="default"
            size="sm"
            className="px-3 py-1.5 text-xs bg-primary/90 hover:bg-primary rounded-full transition-all transform hover:scale-105 flex items-center gap-1 cursor-pointer w-24"
          >
            <Flame className="h-3 w-3 mr-1" /> Remix
          </Button>
        )}
        
        {handleUpscaleImage && (
          <Button 
            onClick={handleUpscaleClick}
            variant="default"
            size="sm"
            className="px-3 py-1.5 text-xs bg-primary/90 hover:bg-primary rounded-full transition-all transform hover:scale-105 flex items-center gap-1 cursor-pointer w-24"
          >
            <ZoomIn className="h-3 w-3 mr-1" /> Upscale
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default ImageCard; 