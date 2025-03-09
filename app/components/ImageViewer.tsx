/* eslint-disable */
'use client'

import { Button } from "@/components/ui/button";
import { Copy, X, Download, Check } from "lucide-react";
import { FC, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Message } from "../types";

interface ImageViewerProps {
  expandedImage: string | null;
  setExpandedImage: (image: string | null) => void;
  currentImageCollection: string[];
  currentImageIndex: number;
  setCurrentImageIndex: (index: number) => void;
  messages: Message[];
}

const ImageViewer: FC<ImageViewerProps> = ({
  expandedImage,
  setExpandedImage,
  currentImageCollection,
  currentImageIndex,
  setCurrentImageIndex,
  messages
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  
  // Reset download state when image changes
  useEffect(() => {
    setIsDownloading(false);
    setDownloadComplete(false);
  }, [expandedImage]);
  
  const handleDownload = async () => {
    if (!expandedImage || isDownloading || downloadComplete) return;
    
    try {
      setIsDownloading(true);
      
      // Fetch the image
      const response = await fetch(expandedImage);
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // Get a simple filename from the URL
      const baseFilename = expandedImage.split('/').pop() || 'image';
      const cleanFilename = baseFilename.includes('?') 
        ? baseFilename.split('?')[0] 
        : baseFilename;
      
      a.href = url;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Show success animation
      setDownloadComplete(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadComplete(false);
      }, 2000);
      
    } catch (error) {
      console.error('Download failed:', error);
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      {expandedImage && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setExpandedImage(null)}
        >
          <motion.div
            className="relative max-w-[95vw] max-h-[90vh] rounded-lg overflow-hidden flex flex-col md:flex-row"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()} // Prevent clicks on the image from closing the modal
          >
            <div className="relative flex-shrink-0">
              <img 
                src={expandedImage} 
                alt="Expanded view" 
                className="max-w-full md:max-w-[60vw] max-h-[70vh] object-contain rounded-md"
              />
              
              {/* Close button */}
              <Button
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedImage(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
              
              {/* Download button */}
              <Button
                className="absolute top-2 right-12 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white p-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                disabled={isDownloading}
              >
                <AnimatePresence mode="wait">
                  {downloadComplete ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check className="h-4 w-4 text-green-400" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="download"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Download className="h-4 w-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
              
              {/* Only show navigation controls if we have multiple images */}
              {currentImageCollection.length > 1 && (
                <>
                  {/* Left arrow */}
                  <Button
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white p-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const prevIndex = (currentImageIndex - 1 + currentImageCollection.length) % currentImageCollection.length;
                      setCurrentImageIndex(prevIndex);
                      setExpandedImage(currentImageCollection[prevIndex]);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left">
                      <path d="m15 18-6-6 6-6"/>
                    </svg>
                  </Button>
                  
                  {/* Right arrow */}
                  <Button
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white p-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextIndex = (currentImageIndex + 1) % currentImageCollection.length;
                      setCurrentImageIndex(nextIndex);
                      setExpandedImage(currentImageCollection[nextIndex]);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </Button>
                  
                  {/* Image counter */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {currentImageCollection.length}
                  </div>
                </>
              )}
            </div>

            {/* Generation details section - now on the right in desktop view */}
            {messages.find(m => 
              m.type === "generated-image" && 
              m.imageUrls?.includes(expandedImage) && 
              m.generationData
            )?.generationData && (
              <div className="bg-background/90 dark:bg-muted/90 backdrop-blur-sm p-4 md:ml-4 mt-2 md:mt-0 rounded-md text-sm overflow-auto max-h-[20vh] md:max-h-[70vh] md:w-[25vw] md:min-w-[300px] border border-gray-200 shadow-sm">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <h3 className="font-semibold mb-1">Prompt</h3>
                    <p className="opacity-90 whitespace-pre-wrap">
                      {messages.find(m => 
                        m.type === "generated-image" && 
                        m.imageUrls?.includes(expandedImage)
                      )?.generationData?.prompt}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs mt-2"
                      onClick={() => {
                        const prompt = messages.find(m => 
                          m.type === "generated-image" && 
                          m.imageUrls?.includes(expandedImage)
                        )?.generationData?.prompt;
                        if (prompt) navigator.clipboard.writeText(prompt);
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy Prompt
                    </Button>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-1">Negative Prompt</h3>
                    <p className="opacity-90 whitespace-pre-wrap">
                      {messages.find(m => 
                        m.type === "generated-image" && 
                        m.imageUrls?.includes(expandedImage)
                      )?.generationData?.negative_prompt}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-1">Model</h3>
                    <p className="opacity-90">
                      {messages.find(m => 
                        m.type === "generated-image" && 
                        m.imageUrls?.includes(expandedImage)
                      )?.generationData?.model}
                    </p>
                  </div>

                  {Object.keys(messages.find(m => 
                    m.type === "generated-image" && 
                    m.imageUrls?.includes(expandedImage)
                  )?.generationData?.loras || {}).length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-1">LoRAs</h3>
                      {Object.entries(messages.find(m => 
                        m.type === "generated-image" && 
                        m.imageUrls?.includes(expandedImage)
                      )?.generationData?.loras || {}).map(([urn, config], idx) => (
                        <div key={idx} className="flex items-center gap-1 opacity-90">
                          <span className="truncate">{urn.split(':').pop()}</span>
                          <span className="opacity-70">
                            ({(config as any).strength || (config as any).weight || 1.0})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageViewer; 