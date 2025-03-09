'use client'

import { useState, useCallback } from 'react';
import { Message, MessageType } from '../types';
import { addTermToGlossary } from '@/lib/supabase';

interface TextLookupProps {
  setInputText: (text: string) => void;
  setMessages: (value: React.SetStateAction<Message[]>) => void;
  setIsSending: (value: React.SetStateAction<boolean>) => void;
  setError: (value: React.SetStateAction<string | null>) => void;
  simulateTyping: (text: string, messageId: string, onComplete?: () => void) => void;
  triggerGlossaryRefresh: () => void;
}

export const useTextLookup = ({
  setInputText,
  setMessages,
  setIsSending,
  setError,
  simulateTyping,
  triggerGlossaryRefresh
}: TextLookupProps) => {
  const [lastSelectedText, setLastSelectedText] = useState<string>('');

  const handleTextLookup = useCallback(async (selectedText: string) => {
    if (!selectedText) return;
    
    setLastSelectedText(selectedText);
    
    // Format the detailed prompt for the backend, asking for a category
    const backendPrompt = `
    explain what "${selectedText}" means in simple terms in the language that the user uses in the chat window.
    
    Also, at the end of your response, please include a line with "CATEGORY: [category]" where [category] is a single word
    that best categorizes this term (like mathematics, literature, science, technology, history, etc.).
    This category tag should be on its own line at the very end.`;
    
    // Create a simplified user-facing message for the chat
    const userMessage = `explain the "${selectedText}" to me`;
    
    const messageId = Date.now().toString();
    
    // Add simplified user message to the chat
    setMessages(prev => [
      ...prev, 
      {
        id: messageId,
        content: userMessage,
        type: "text" as MessageType,
        isUser: true
      }
    ]);
    
    // Add loading message
    const loadingId = `loading-${messageId}`;
    setMessages(prev => [
      ...prev,
      {
        id: loadingId,
        content: "Looking up term...",
        type: "loading" as MessageType,
        isUser: false
      }
    ]);
    
    try {
      // Set sending state
      setIsSending(true);
      
      // Call the interpret endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      // Create FormData to send the detailed prompt
      const formData = new FormData();
      formData.append('text', backendPrompt);
      
      const response = await fetch(`${apiUrl}/interpret`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      let aiResponse = data.response;
      
      // Extract category from response if present
      let category = 'Uncategorized';
      const categoryMatch = aiResponse.match(/CATEGORY:\s*(\w+)/i);
      
      if (categoryMatch && categoryMatch[1]) {
        category = categoryMatch[1].trim();
        
        // Remove the category line from the displayed response
        aiResponse = aiResponse.replace(/CATEGORY:\s*\w+/i, '').trim();
      }
      
      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingId));
      
      // Show typing animation for the response
      const aiMessageId = `lookup-${Date.now()}`;
      simulateTyping(aiResponse, aiMessageId);
      
      // Save the term to Supabase
      try {
        await addTermToGlossary(selectedText, aiResponse, category);
        
        // Trigger refresh of the glossary
        triggerGlossaryRefresh();
      } catch (dbError) {
        console.error('Failed to save term to glossary:', dbError);
        // We don't want to interrupt the user experience if DB saving fails
      }
      
    } catch (error) {
      console.error("Error sending lookup request:", error);
      setError(`Failed to get explanation: ${error instanceof Error ? error.message : String(error)}`);
      
      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingId));
    } finally {
      setIsSending(false);
    }
    
  }, [setInputText, setMessages, setIsSending, setError, simulateTyping, triggerGlossaryRefresh]);

  return {
    lastSelectedText,
    handleTextLookup
  };
};

export default useTextLookup; 