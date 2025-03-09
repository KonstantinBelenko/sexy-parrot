'use client'

import { useState, useRef, useEffect } from "react";

export const useInputHandling = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingInitializing, setIsRecordingInitializing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Auto-resize textarea when content changes
  useEffect(() => {
    if (textareaRef.current && !isRecording) {
      // Reset height to get the correct scrollHeight
      textareaRef.current.style.height = "auto";
      // Set the height to match content + a small buffer
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText, isRecording]);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    // Handle the dropped files
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    );
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.type.startsWith('image/')
      );
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };
  
  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  };
  
  const startRecording = async () => {
    try {
      setIsRecordingInitializing(true);
      
      // Audio constraints optimized to minimize headphone issues
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          // Use a lower sample rate to reduce Bluetooth profile switching issues
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Specifically request mono audio to avoid stereo->mono switching
          channelCount: 1 
        } 
      });
      
      // Options for the MediaRecorder - using a lower bitrate
      const options = { 
        mimeType: 'audio/webm;codecs=opus',
        bitsPerSecond: 16000 // Lower bitrate to reduce Bluetooth issues
      };
      
      // Check if the browser supports this MIME type
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn('audio/webm;codecs=opus not supported, falling back to default');
      }
      
      const mediaRecorder = new MediaRecorder(stream, 
        MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined
      );
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Use a full recording instead of streaming chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Stop all tracks to release the microphone ASAP
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        
        setIsRecording(false);
        
        // Process the complete recording at once instead of in chunks
        if (audioChunksRef.current.length > 0) {
          setIsTranscribing(true);
          
          // Combine all audio chunks into a single blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          try {
            await transcribeAudioChunk(audioBlob);
          } finally {
            setIsTranscribing(false);
          }
        }
      };
      
      // Start recording without timeslice parameter to minimize chunking
      mediaRecorder.start();
      
      // Add a delay before showing recording state
      setTimeout(() => {
        setIsRecordingInitializing(false);
        setIsRecording(true);
      }, 500);
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setIsRecordingInitializing(false);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };
  
  const transcribeAudioChunk = async (audioChunk: Blob) => {
    try {
      // Create a FormData object to send the audio
      const formData = new FormData();
      formData.append('file', audioChunk, 'audio.webm');
      formData.append('model', 'whisper-large-v3-turbo');
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Transcription API error:', data);
        return;
      }
      
      // Print the full response to console for debugging
      console.log("Interpret endpoint response:", data);
      
      // Append the transcribed text to the input
      if (data.text) {
        setInputText(prev => `${prev} ${data.text}`.trim());
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
    }
  };
  
  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);
  
  return {
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
  };
}; 