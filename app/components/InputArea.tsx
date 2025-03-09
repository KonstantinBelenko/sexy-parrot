/* eslint-disable */
'use client'

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowUpCircle, ImageIcon, Mic, StopCircle, X } from "lucide-react";
import { FC, RefObject, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InputAreaProps {
  inputPosition: "center" | "bottom";
  isDragging: boolean;
  inputText: string;
  isRecording: boolean;
  isRecordingInitializing: boolean;
  isTranscribing: boolean;
  isSending: boolean;
  files: File[];
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  inputContainerRef: React.RefObject<HTMLDivElement>;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSend: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  handleImageButtonClick: () => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (index: number) => void;
  error: string | null;
  dismissError: () => void;
}

const InputArea: FC<InputAreaProps> = ({
  inputPosition,
  isDragging,
  inputText,
  isRecording,
  isRecordingInitializing,
  isTranscribing,
  isSending,
  files,
  textareaRef,
  fileInputRef,
  inputContainerRef,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleInputChange,
  handleSend,
  startRecording,
  stopRecording,
  handleImageButtonClick,
  handleFileInputChange,
  removeFile,
  error,
  dismissError
}) => {
  // Memoized file pills component to prevent re-renders during typing
  const FilePills = () => {
    if (files.length === 0) return null;
    
    return (
      <div className="absolute top-0 left-0 right-0 transform -translate-y-full pb-2 w-full px-4 z-50">
        <motion.div 
          initial={{ opacity: 1 }}
          className="w-full flex flex-wrap gap-2 pointer-events-auto relative"
        >
          <AnimatePresence initial={false}>
            {files.map((file, index) => (
              <motion.div
                key={`file-${file.name}-${index}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ 
                  duration: 0.2,
                  ease: [0.16, 1, 0.3, 1], // Custom ease curve for smoother animation
                  delay: index * 0.03 // Slight stagger for multiple files
                }}
                className="flex items-center bg-background border rounded-full pl-3 pr-3 py-1 text-sm shadow-sm group"
              >
                <div className="relative" style={{ width: '26px', height: '26px' }}>
                  <motion.div
                    className="absolute inset-0"
                    initial={{ scale: 1 }}
                    animate={{ scale: 1 }}
                    whileHover="hover"
                    variants={{
                      hover: {
                        scale: 1,
                      }
                    }}
                  >
                    {/* Invisible hover trigger area */}
                    <div className="absolute inset-0 cursor-pointer z-10" />
                    
                    {/* Normal thumbnail image (always visible) */}
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-6 h-6 object-cover mr-2 cursor-pointer rounded-full"
                    />
                    
                    {/* Preview that appears on hover */}
                    <motion.div
                      className="absolute top-0 left-0 origin-top-left"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 0, scale: 0 }}
                      variants={{
                        hover: { 
                          opacity: 1,
                          scale: 1,
                          zIndex: 9999
                        }
                      }}
                      transition={{
                        type: "spring", 
                        damping: 20,
                        stiffness: 300,
                        mass: 0.6
                      }}
                      style={{
                        pointerEvents: "none"
                      }}
                    >
                      <div className="bg-background rounded-md p-1 shadow-lg" style={{ position: 'absolute', top: 20, left: 0 }}>
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview of ${file.name}`}
                          style={{
                            maxWidth: '250px',
                            maxHeight: '250px',
                            borderRadius: '2px',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    </motion.div>
                  </motion.div>
                </div>
                <span className="truncate max-w-[100px]">{file.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 ml-1 rounded-full hover:bg-muted cursor-pointer"
                  onClick={() => removeFile(index)}
                  disabled={isSending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="fixed w-[calc(100%-20rem)] pointer-events-none left-0" style={{ bottom: 0 }}>
      <motion.div 
        className="w-full mx-auto flex justify-center items-end pointer-events-none"
        initial={{ y: 0 }}
        animate={{ 
          y: inputPosition === "center" 
            ? "calc(-50vh + 28px)" 
            : "-24px"
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 28,
          mass: 1.0,
          restDelta: 0.001,
          restSpeed: 0.001
        }}
      >
        <div 
          ref={inputContainerRef}
          className={cn(
            "w-full max-w-2xl relative transition-all duration-200 pointer-events-auto px-4 mb-8",
            isDragging && "scale-105"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Render file pills */}
          <FilePills />

          <AnimatePresence 
            initial={false} 
            mode="wait"
            presenceAffectsLayout={false} // Prevents layout shift during animations
          >
            {isDragging ? (
              <motion.div
                key="drag-area"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full min-h-[56px] rounded-full border-2 border-dashed border-primary bg-muted/50 flex items-center justify-center text-base shadow-sm"
              >
                Drop images here
              </motion.div>
            ) : (
              <motion.div
                key="input-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative"
              >
                <Textarea 
                  ref={textareaRef}
                  placeholder="Create..." 
                  className="w-full shadow-sm text-base min-h-[56px] max-h-[300px] rounded-[28px] pl-6 pr-24 py-3 resize-none overflow-hidden leading-[1.6] flex items-center"
                  value={inputText}
                  onChange={handleInputChange}
                  rows={1}
                  style={{
                    height: 'auto',
                    paddingTop: inputText ? '12px' : '13px',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && inputText.trim()) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isRecording}
                />
                <div className="absolute right-2 top-7 transform -translate-y-1/2 flex gap-1">
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <Button 
                      size="icon" 
                      variant={isRecording ? "default" : "ghost"}
                      className={cn(
                        "h-10 w-10 rounded-full cursor-pointer",
                        isTranscribing && "animate-pulse",
                        isRecording && "animate-pulse shadow-md bg-destructive text-destructive-foreground",
                        isRecordingInitializing && "animate-pulse opacity-70"
                      )}
                      aria-label={isRecording ? "Stop recording" : "Voice input"}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isTranscribing || isSending || isRecordingInitializing}
                    >
                      {isRecording ? (
                        <StopCircle className="h-5 w-5 text-white" />
                      ) : isRecordingInitializing ? (
                        <div className="h-5 w-5 flex items-center justify-center">
                          <div className="h-2 w-2 bg-foreground/70 rounded-full animate-ping" />
                        </div>
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </Button>
                  </motion.div>
                  {/*<motion.div whileTap={{ scale: 0.9 }}>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-10 w-10 rounded-full cursor-pointer"
                      aria-label="Attach image"
                      onClick={handleImageButtonClick}
                      disabled={isSending}
                    >
                      <ImageIcon className="h-5 w-5" />
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={handleFileInputChange}
                      />
                    </Button>
                  </motion.div>*/}
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <Button 
                      size="icon" 
                      variant={inputText.trim() ? "default" : "ghost"}
                      className={cn(
                        "h-10 w-10 rounded-full cursor-pointer",
                        isSending && "animate-pulse"
                      )}
                      aria-label="Send message"
                      onClick={handleSend}
                      disabled={!inputText.trim() || isSending}
                    >
                      <ArrowUpCircle className="h-5 w-5" />
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Error message */}
        {error && (
          <div className={cn(
            "absolute left-0 right-0 flex justify-center",
            inputPosition === "bottom" ? "bottom-24" : "top-3"
          )}>
            <motion.div 
              initial={{ opacity: 0, y: inputPosition === "bottom" ? 20 : -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: inputPosition === "bottom" ? 20 : -20 }}
              className="bg-destructive text-white px-4 py-2 rounded-md text-sm max-w-md flex items-center gap-2"
            >
              <span className="flex-1">{error}</span>
              <Button 
                size="icon" 
                variant="destructive" 
                className="h-6 w-6 border border-white/30 rounded-full hover:bg-white/20"
                onClick={dismissError}
              >
                <X className="h-3 w-3" />
              </Button>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default InputArea; 