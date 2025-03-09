'use client'

import { useState, useEffect } from "react";

export const useImageViewer = () => {
  // State for expanded image modal
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  // State for image collection navigation
  const [currentImageCollection, setCurrentImageCollection] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  
  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  
  // Open an image for viewing with its collection context
  const openImageViewer = (url: string, collection: string[], index: number) => {
    setCurrentImageCollection(collection);
    setCurrentImageIndex(index);
    setExpandedImage(url);
  };
  
  // Handle keyboard navigation for image gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!expandedImage || currentImageCollection.length <= 1) return;
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        // Navigate to next image
        const nextIndex = (currentImageIndex + 1) % currentImageCollection.length;
        setCurrentImageIndex(nextIndex);
        setExpandedImage(currentImageCollection[nextIndex]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        // Navigate to previous image
        const prevIndex = (currentImageIndex - 1 + currentImageCollection.length) % currentImageCollection.length;
        setCurrentImageIndex(prevIndex);
        setExpandedImage(currentImageCollection[prevIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setExpandedImage(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedImage, currentImageCollection, currentImageIndex]);
  
  return {
    expandedImage,
    setExpandedImage,
    currentImageCollection,
    setCurrentImageCollection,
    currentImageIndex,
    setCurrentImageIndex,
    showImageViewer,
    setShowImageViewer,
    viewerImageIndex,
    setViewerImageIndex,
    viewerImages,
    setViewerImages,
    openImageViewer
  };
}; 