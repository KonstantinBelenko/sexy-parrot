'use client'

import { useEffect, useState } from "react"
import { AnimatePresence } from "framer-motion"
import MessageItem from "./components/MessageItem"
import InputArea from "./components/InputArea"
import ImageViewer from "./components/ImageViewer"
import TextSelectionLookup from "./components/TextSelectionLookup"
import Glossary from "./components/Glossary"
import { useMessages } from "./hooks/useMessages"
import { useInputHandling } from "./hooks/useInputHandling"
import { useImageViewer } from "./hooks/useImageViewer"
import { useMessageSending } from "./hooks/useMessageSending"
import { useTextLookup } from "./hooks/useTextLookup"

export default function Home() {
  // State to trigger glossary refresh
  const [glossaryRefreshCounter, setGlossaryRefreshCounter] = useState(0);
  
  // Function to trigger glossary refresh
  const triggerGlossaryRefresh = () => {
    setGlossaryRefreshCounter(prev => prev + 1);
  };
  
  // Get message state and handlers from hooks
  const {
    messages,
    setMessages,
    messagesSent,
    setMessagesSent,
    inputPosition,
    setInputPosition,
    isEditingAnyMessage,
    copiedMessageId,
    setCopiedMessageId,
    isSending,
    setIsSending,
    error,
    setError,
    messagesEndRef,
    simulateTyping,
    handleEditMessage,
    handleSaveEdit,
    handleCancelEdit,
    handleCopyMessage,
    dismissError
  } = useMessages();
  
  // Get input handling state and handlers
  const {
    isDragging,
    files,
    setFiles,
    inputText,
    setInputText,
    isRecording,
    isRecordingInitializing,
    isTranscribing,
    textareaRef,
    fileInputRef,
    inputContainerRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    handleImageButtonClick,
    removeFile,
    handleInputChange,
    startRecording,
    stopRecording
  } = useInputHandling();
  
  // Get image viewer state and handlers
  const {
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
  } = useImageViewer();
  
  // Get message sending handlers
  const { handleRerunMessage, handleSend, handleRemixImage, handleUpscaleImage } = useMessageSending({
    setMessages,
    setInputText,
    setFiles,
    setInputPosition,
    setMessagesSent,
    setIsSending,
    setError,
    simulateTyping,
    messagesSent
  });
  
  // Get text lookup handler
  const { handleTextLookup } = useTextLookup({
    setInputText,
    setMessages,
    setIsSending,
    setError,
    simulateTyping,
    triggerGlossaryRefresh
  });
  
  // Add useEffect for theme detection
  useEffect(() => {
    // Check if the user has a system preference for dark mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Function to update the theme based on the media query
    const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // If the system preference is dark, add the 'dark' class to the document
      // Otherwise, remove it
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    
    // Initial theme setting
    handleThemeChange(mediaQuery);
    
    // Add event listener for changes
    mediaQuery.addEventListener('change', handleThemeChange);
    
    // Clean up the event listener when component unmounts
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);
  
  // Wrap handleSend to pass the current values
  const sendMessage = () => handleSend(inputText, files);

  return (
    <div className="relative min-h-screen">
      {/* Text selection lookup component */}
      <TextSelectionLookup onLookup={handleTextLookup} />
      
      {/* Main content area with chat and glossary */}
      <div className="flex w-full min-h-screen">
        {/* Chat area */}
        <div className="flex-1 pb-[150px] pt-4">
          <div className="w-full max-w-2xl mx-auto px-4">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  handleEditMessage={handleEditMessage}
                  handleRerunMessage={handleRerunMessage}
                  handleCopyMessage={handleCopyMessage}
                  handleSaveEdit={handleSaveEdit}
                  handleCancelEdit={handleCancelEdit}
                  copiedMessageId={copiedMessageId}
                  openImageViewer={openImageViewer}
                  handleRemixImage={handleRemixImage}
                  handleUpscaleImage={handleUpscaleImage}
                />
              ))}
            </AnimatePresence>
            
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {/* Glossary sidebar */}
        <div className="hidden lg:block w-80 p-4 border-l">
          <Glossary 
            className="sticky top-4" 
            refreshTrigger={glossaryRefreshCounter} 
          />
        </div>
      </div>
      
      {/* Image viewer component */}
      <ImageViewer
        expandedImage={expandedImage}
        setExpandedImage={setExpandedImage}
        currentImageCollection={currentImageCollection}
        currentImageIndex={currentImageIndex}
        setCurrentImageIndex={setCurrentImageIndex}
        messages={messages}
      />
      
      {/* Input area component */}
      <InputArea
        inputPosition={inputPosition}
        isDragging={isDragging}
        inputText={inputText}
        isRecording={isRecording}
        isRecordingInitializing={isRecordingInitializing}
        isTranscribing={isTranscribing}
        isSending={isSending}
        files={files}
        textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
        inputContainerRef={inputContainerRef as React.RefObject<HTMLDivElement>}
        handleDragOver={handleDragOver}
        handleDragLeave={handleDragLeave}
        handleDrop={handleDrop}
        handleInputChange={handleInputChange}
        handleSend={sendMessage}
        startRecording={startRecording}
        stopRecording={stopRecording}
        handleImageButtonClick={handleImageButtonClick}
        handleFileInputChange={handleFileInputChange}
        removeFile={removeFile}
        error={error}
        dismissError={dismissError}
      />
    </div>
  );
}
