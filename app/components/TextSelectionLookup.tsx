'use client'

import { FC, useEffect, useState, useRef } from 'react';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TextSelectionLookupProps {
  onLookup: (selectedText: string) => void;
}

const TextSelectionLookup: FC<TextSelectionLookupProps> = ({ onLookup }) => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [iconPosition, setIconPosition] = useState<{ x: number; y: number } | null>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectedText('');
        setIconPosition(null);
        return;
      }

      const text = selection.toString().trim();
      setSelectedText(text);

      // Get the position of the selection
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Position the icon at the end of the selection
      setIconPosition({
        x: rect.right,
        y: rect.top - 10 // Position slightly above the selection
      });
    };

    // Attach event listeners for text selection
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);

    return () => {
      // Clean up event listeners
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('keyup', handleSelectionChange);
    };
  }, []);

  const handleClick = () => {
    if (selectedText) {
      onLookup(selectedText);
      // Clear selection after lookup
      window.getSelection()?.removeAllRanges();
      setSelectedText('');
      setIconPosition(null);
    }
  };

  return (
    <AnimatePresence>
      {iconPosition && selectedText && (
        <motion.div
          ref={iconRef}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.1 }} // Animation under 100ms as per requirements
          className="fixed z-50 shadow-md rounded-full bg-background border"
          style={{
            left: `${iconPosition.x}px`,
            top: `${iconPosition.y}px`,
            transform: 'translate(8px, -50%)',
          }}
        >
          <button
            onClick={handleClick}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
            title="Look up selected text"
          >
            <Search className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TextSelectionLookup; 