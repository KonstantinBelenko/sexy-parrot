/* eslint-disable */
'use client'

import { useState, useRef, useEffect } from "react";
import { Message, MessageType } from "../types";

export const useMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesSent, setMessagesSent] = useState(0);
  const [inputPosition, setInputPosition] = useState<"center" | "bottom">("center");
  const [isEditingAnyMessage, setIsEditingAnyMessage] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const previousMessagesLengthRef = useRef(messages.length);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Handle scrolling to bottom on new messages
  useEffect(() => {
    // Only scroll if:
    // 1. We added a new message (length increased)
    // 2. No message is currently being edited
    const shouldScroll = 
      messages.length > previousMessagesLengthRef.current || 
      (messages.length > 0 && !messages.some(msg => msg.isEditing) && isEditingAnyMessage);
    
    if (shouldScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    
    // Update refs for next comparison
    previousMessagesLengthRef.current = messages.length;
    setIsEditingAnyMessage(messages.some(msg => msg.isEditing));
  }, [messages, isEditingAnyMessage]);
  
  // Simulate typing effect for text responses
  const simulateTyping = (text: string, messageId: string, onComplete?: () => void) => {
    // Start with an empty typing message in the messages array
    setMessages(prev => [
      ...prev, 
      {
        id: messageId,
        content: "",
        type: "typing", // Mark as typing
        isUser: false
      }
    ]);
    
    let i = 0;
    let accumulatedText = ""; // Accumulate text outside of React state
    const speed = 10; // ms per character, adjust for slower/faster typing
    
    const type = () => {
      if (i < text.length) {
        // Accumulate text correctly
        accumulatedText += text.charAt(i);
        
        // Update with the complete accumulated text
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: accumulatedText }
              : msg
          )
        );
        i++;
        setTimeout(type, speed);
      } else {
        // When typing finishes, change the type to normal text
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, type: "text" }
              : msg
          )
        );
        
        // Call the onComplete callback if provided
        if (onComplete) {
          onComplete();
        }
      }
    };
    
    type();
  };
  
  // Handle edit mode for a message
  const handleEditMessage = (messageId: string) => {
    // Set edit mode for this message
    setIsEditingAnyMessage(true);
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isEditing: true }
          : msg
      )
    );
  };
  
  // Handle saving edited message
  const handleSaveEdit = async (messageId: string, newContent: string) => {
    // Find the message index
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;
    
    // Save the updated message content and exit edit mode
    setIsEditingAnyMessage(false);
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: newContent, isEditing: false }
          : msg
      )
    );
    
    // Remove all messages that came after this user message (the AI responses)
    setMessages(prev => prev.filter((_, index) => index <= messageIndex));
  };
  
  // Handle cancel edit
  const handleCancelEdit = (messageId: string) => {
    setIsEditingAnyMessage(false);
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isEditing: false }
          : msg
      )
    );
  };
  
  // Handle copying message content to clipboard
  const handleCopyMessage = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        // Set this message as copied to show checkmark
        setCopiedMessageId(messageId);
        console.log('Message copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy message:', err);
        setError('Failed to copy message to clipboard');
      });
  };
  
  // Dismiss error message
  const dismissError = () => {
    setError(null);
  };
  
  return {
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
  };
}; 