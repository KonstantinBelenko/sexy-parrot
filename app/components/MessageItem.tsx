/* eslint-disable */
'use client'

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, Copy, Pencil, RefreshCw } from "lucide-react";
import { FC, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Message } from "../types";
import ImageCard from "./ImageCard";
import GenerationDataLogger from "./GenerationDataLogger";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Custom component to render latex and markdown
const ContentRenderer: FC<{ content: string }> = ({ content }) => {
  // Log the content for debugging
  useEffect(() => {
    console.log('Message content:', content);
  }, [content]);

  // Function to render latex expressions
  const renderLatex = (text: string) => {
    // First, handle explicit newlines and normalize spaces
    text = text
      .replace(/\\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Try to detect and fix common latex formatting issues
    text = text
      // Handle document structure commands
      .replace(/\\documentclass\{([^}]+)\}/, '')
      .replace(/\\begin\{document\}/, '')
      .replace(/\\end\{document\}/, '')
      .replace(/\\usepackage(?:\[[^]]*\])?\{([^}]+)\}/g, '')
      // Fix standalone math symbols that should be in math mode
      .replace(/(?<![\\$])([\+\-=×÷±∫∑∏√∞≈≠≤≥∂∇]|[a-zA-Z]\^[0-9]|[a-zA-Z]_[0-9])(?![\\$])/g, '$$$1$$')
      // Fix equations that look like they should be in display math
      .replace(/^([^$]*?=.+)$/gm, '$$$$1$$')
      // Fix subscripts and superscripts that should be in math mode
      .replace(/([a-zA-Z])([_\^][0-9a-zA-Z]+)/g, '$$1$2$$')
      // Fix common math environments
      .replace(/\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g, '$$$$2$$')
      // Fix square roots and fractions that should be in math mode
      .replace(/\\(?:sqrt|frac)\{[^}]+\}(?:\{[^}]+\})?/g, (match) => `$${match}$$`)
      // Fix common math operators
      .replace(/\\(?:sin|cos|tan|log|ln|exp|lim|sup|inf|max|min)\b/g, (match) => `$${match}$$`)
      // Fix quadratic formula and other common equations
      .replace(/x\s*=\s*\\frac\{-b\s*±\s*\\sqrt\{b\^2\s*-\s*4ac\}\}\{2a\}/g, '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$')
      .replace(/\\int(?:_\{[^}]+\})?\^?\{?[^}]*\}?/g, (match) => `$${match}$$`)
      .replace(/\\sum(?:_\{[^}]+\})?\^?\{?[^}]*\}?/g, (match) => `$${match}$$`);
    
    const parts = [];
    let currentIndex = 0;
    
    // Match both inline/display math and latex commands
    const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^\$]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\\[a-zA-Z]+{[^}]*}(?:{[^}]*})?|\\[a-zA-Z]+)/g;
    let match;
    
    while ((match = mathRegex.exec(text)) !== null) {
      // Add text before the match as markdown
      if (match.index > currentIndex) {
        const textPart = text.slice(currentIndex, match.index);
        parts.push(
          <ReactMarkdown
            key={`md-${currentIndex}`}
            remarkPlugins={[remarkGfm]}
            components={{
              // Override default link behavior to open in new tab
              a: ({ node, ...props }) => (
                <a target="_blank" rel="noopener noreferrer" {...props} />
              ),
              // Style code blocks
              code: ({ children, className, ...props }) => {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match;
                return (
                  <code
                    className={cn(
                      "bg-muted/50 rounded px-1.5 py-0.5",
                      isInline ? "text-sm" : "block p-4 text-sm"
                    )}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              // Style pre blocks (code block containers)
              pre: ({ children, ...props }) => (
                <pre className="bg-muted/50 rounded-lg overflow-x-auto p-4" {...props}>
                  {children}
                </pre>
              )
            }}
          >
            {textPart}
          </ReactMarkdown>
        );
      }
      
      const latex = match[0];
      
      // Handle different types of latex content
      if (latex.startsWith('$') || latex.startsWith('\\(') || latex.startsWith('\\[')) {
        // Math expression
        const isDisplay = latex.startsWith('$$') || latex.startsWith('\\[');
        try {
          const cleanLatex = latex
            .replace(/^\$\$|\$\$$/g, '')
            .replace(/^\$|\$$/g, '')
            .replace(/^\\\(|\\\)$/g, '')
            .replace(/^\\\[|\\\]$/g, '')
            // Normalize spaces in math expressions
            .replace(/\s+/g, ' ')
            .trim();
            
          const html = katex.renderToString(cleanLatex, {
            displayMode: isDisplay,
            throwOnError: false,
            strict: false,
            trust: true,
            macros: {
              // Common math macros
              '\\R': '\\mathbb{R}',
              '\\N': '\\mathbb{N}',
              '\\Z': '\\mathbb{Z}',
              '\\Q': '\\mathbb{Q}',
              // Common operators
              '\\abs': '|#1|',
              '\\norm': '\\|#1\\|',
              '\\inner': '\\langle #1,#2 \\rangle',
              // Common shortcuts
              '\\eps': '\\varepsilon',
              '\\phi': '\\varphi',
              '\\to': '\\rightarrow',
              '\\iff': '\\Leftrightarrow',
              '\\dd': '\\mathrm{d}',
              '\\diff': '\\frac{\\dd}{\\dd #1}',
              '\\pdiff': '\\frac{\\partial}{\\partial #1}'
            }
          });
          
          parts.push(
            <span 
              key={`latex-${match.index}`}
              dangerouslySetInnerHTML={{ __html: html }}
              className={cn(
                "inline-block",
                isDisplay && "my-4 w-full text-center"
              )}
            />
          );
        } catch (error) {
          console.error('LaTeX rendering error:', error);
          parts.push(latex);
        }
      } else {
        // LaTeX commands
        const cmdMap: { [key: string]: string } = {
          '\\textbf': 'font-bold',
          '\\textit': 'italic',
          '\\emph': 'italic',
          '\\title': 'text-2xl font-bold mb-4',
          '\\author': 'text-xl mb-2',
          '\\date': 'text-lg mb-4',
          '\\section': 'text-xl font-bold mt-6 mb-4',
          '\\subsection': 'text-lg font-bold mt-4 mb-2',
          '\\equation': 'text-xl font-bold mt-6 mb-4',
          '\\maketitle': 'border-b pb-4 mb-6',
          '\\documentclass': '', // ignore document class
          '\\usepackage': '', // ignore package imports
          '\\begin': '', // ignore environment begin
          '\\end': '', // ignore environment end
          '\\today': '' // will be replaced with current date
        };
        
        // Extract command and content
        const cmdMatch = latex.match(/\\([a-zA-Z]+)(?:{([^}]*)})?(?:{([^}]*)})?/);
        if (cmdMatch) {
          const [_, cmd, content1, content2] = cmdMatch;
          const className = cmdMap[`\\${cmd}`];
          
          if (className) {
            if (cmd === 'today') {
              parts.push(
                <span key={`cmd-${match.index}`}>
                  {new Date().toLocaleDateString()}
                </span>
              );
            } else {
              parts.push(
                <span key={`cmd-${match.index}`} className={className}>
                  {content1 || ''}
                  {content2 ? ` ${content2}` : ''}
                </span>
              );
            }
          } else if (['documentclass', 'usepackage', 'begin', 'end'].includes(cmd)) {
            // ignore these commands
          } else {
            // try to handle special commands
            switch (cmd) {
              case 'today':
                parts.push(
                  <span key={`cmd-${match.index}`}>
                    {new Date().toLocaleDateString()}
                  </span>
                );
                break;
              default:
                parts.push(latex); // Unknown command, keep as is
            }
          }
        } else {
          parts.push(latex);
        }
      }
      
      currentIndex = mathRegex.lastIndex;
    }
    
    // Add remaining text as markdown
    if (currentIndex < text.length) {
      const textPart = text.slice(currentIndex);
      parts.push(
        <ReactMarkdown
          key={`md-${currentIndex}`}
          remarkPlugins={[remarkGfm]}
          components={{
            // Override default link behavior to open in new tab
            a: ({ node, ...props }) => (
              <a target="_blank" rel="noopener noreferrer" {...props} />
            ),
            // Style code blocks
            code: ({ children, className, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match;
              return (
                <code
                  className={cn(
                    "bg-muted/50 rounded px-1.5 py-0.5",
                    isInline ? "text-sm" : "block p-4 text-sm"
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            },
            // Style pre blocks (code block containers)
            pre: ({ children, ...props }) => (
              <pre className="bg-muted/50 rounded-lg overflow-x-auto p-4" {...props}>
                {children}
              </pre>
            )
          }}
        >
          {textPart}
        </ReactMarkdown>
      );
    }
    
    return parts;
  };
  
  return <div className="content-renderer">{renderLatex(content)}</div>;
};

interface MessageItemProps {
  message: Message;
  handleEditMessage: (messageId: string) => void;
  handleRerunMessage: (content: string, messageId: string, files?: File[]) => void;
  handleCopyMessage: (content: string, messageId: string) => void;
  handleSaveEdit: (messageId: string, newContent: string) => void;
  handleCancelEdit: (messageId: string) => void;
  copiedMessageId: string | null;
  openImageViewer: (url: string, collection: string[], index: number) => void;
  handleRemixImage?: (generationData: any, imageIndex?: number, totalImages?: number) => void;
  handleUpscaleImage?: (url: string, imageIndex?: number) => void;
}

const MessageItem: FC<MessageItemProps> = ({
  message,
  handleEditMessage,
  handleRerunMessage,
  handleCopyMessage,
  handleSaveEdit,
  handleCancelEdit,
  copiedMessageId,
  openImageViewer,
  handleRemixImage,
  handleUpscaleImage
}) => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    if (message.type === "generating-image") {
      if (message.progressPercentage === undefined) {
        const interval = setInterval(() => {
          setProgress(prev => {
            return prev < 95 ? prev + (95 / 40) : prev;
          });
        }, 1000);
        
        return () => clearInterval(interval);
      } else {
        setProgress(message.progressPercentage);
      }
    }
  }, [message.type, message.progressPercentage]);
  
  return (
    <div className={cn(
      "w-full flex",
      (message.type === "generating-image" || message.type === "generated-image") && "max-w-4xl mx-auto"
    )}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={message.type === "loading" ? 
          { opacity: 0, transition: { duration: 0 } } : 
          { opacity: 0, y: -20 }
        }
        transition={{
          duration: 0.3,
          ease: [0.25, 0.1, 0.25, 1.0]
        }}
        className={cn(
          "mb-4 p-3 rounded-lg relative group",
          message.isUser 
            ? "ml-auto bg-primary text-primary-foreground" 
            : "mr-auto bg-muted",
          message.type === "loading" && "bg-muted/50 animate-pulse",
          (message.type === "generating-image" || message.type === "generated-image") && "p-0 overflow-hidden w-full bg-transparent mr-0 ml-0",
          !message.isUser && "prose dark:prose-invert max-w-none" // Add prose styling for markdown
        )}
        style={{
          width: message.type === "generating-image" || message.type === "generated-image" 
            ? '100%' 
            : 'fit-content',
          maxWidth: message.type === "generating-image" || message.type === "generated-image" 
            ? '100%' 
            : '85%'
        }}
      >
        {/* Action buttons that only show on hover for user messages */}
        {message.isUser && message.type !== "loading" && (
          <div className="absolute -left-32 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
            {/* Edit button */}
            <motion.div
              initial={{ scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
            >
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full bg-black text-white shadow-sm hover:bg-black/90 hover:text-white border-none cursor-pointer"
                onClick={() => handleEditMessage(message.id)}
                title="Edit this message"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          
            {/* Rerun button */}
            <motion.div
              initial={{ scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
            >
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full bg-black text-white shadow-sm hover:bg-black/90 hover:text-white border-none cursor-pointer"
                onClick={() => handleRerunMessage(message.content, message.id, message.files)}
                title="Re-run this message"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
            
            {/* Copy button */}
            <motion.div
              initial={{ scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
            >
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full bg-black text-white shadow-sm hover:bg-black/90 hover:text-white border-none cursor-pointer"
                onClick={() => handleCopyMessage(message.content, message.id)}
                title="Copy message text"
                onMouseLeave={() => copiedMessageId === message.id}
              >
                {copiedMessageId === message.id ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </motion.div>
          </div>
        )}
        
        {/* Copy button for AI messages (non-user messages) */}
        {!message.isUser && message.type !== "loading" && message.type !== "generating-image" && message.content && (
          <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <motion.div
              initial={{ scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
            >
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 rounded-full bg-black/40 text-white shadow-sm hover:bg-black/60 hover:text-white border-none cursor-pointer"
                onClick={() => handleCopyMessage(message.content, message.id)}
                title="Copy message text"
                onMouseLeave={() => copiedMessageId === message.id}
              >
                {copiedMessageId === message.id ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </motion.div>
          </div>
        )}
        
        {message.type === "loading" ? (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        ) : message.type === "typing" ? (
          <div className={message.isUser ? "text-right" : ""}>
            {message.content}
            <span className="ml-1 inline-block animate-pulse">▌</span>
          </div>
        ) : message.isEditing ? (
          // Editing mode
          <div className="w-full">
            <div className="bg-primary p-3 rounded-lg">
              <Textarea
                className="w-full bg-transparent border-none focus-visible:ring-0 focus:outline-none resize-none text-right text-primary-foreground dark:text-primary-foreground"
                autoFocus
                defaultValue={message.content}
                style={{
                  minHeight: '1.5rem',
                  height: 'auto',
                  overflowY: 'hidden',
                  padding: '0',
                  fontSize: '1rem',
                  lineHeight: '1.5',
                  outline: 'none',
                  boxShadow: 'none'
                }}
                onFocus={(e) => {
                  // Auto-resize on focus
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  // Place cursor at end of text
                  const val = e.target.value;
                  e.target.value = '';
                  e.target.value = val;
                }}
                onChange={(e) => {
                  // Auto-resize as user types
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit(message.id, e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    handleCancelEdit(message.id);
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCancelEdit(message.id)}
                className="h-7 px-2 text-xs cursor-pointer hover:cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={(e) => {
                  const textarea = e.currentTarget.parentElement?.parentElement?.querySelector('textarea') as HTMLTextAreaElement;
                  if (textarea) {
                    handleSaveEdit(message.id, textarea.value);
                  }
                }}
                className="h-7 px-2 text-xs cursor-pointer hover:cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
            </div>
          </div>
        ) : message.type === "generating-image" ? (
          <div className="w-full">
            <div className="flex flex-col gap-3 p-3 mb-2 mt-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <div className="text-sm text-muted-foreground">
                {message.content || "Generating image..."}
              </div>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-in-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {message.numImages && message.numImages > 1 ? `Generating ${message.numImages} images...` : "Generating image..."}
              </div>
            </div>
          </div>
        ) : message.type === "generated-image" ? (
          <div className="w-full">
            {message.content && (
              <div className="text-sm text-muted-foreground p-3 mb-2">
                {message.content}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {message.imageUrls?.map((url, index) => (
                <ImageCard
                  key={url}
                  url={url}
                  index={index}
                  totalImages={message.imageUrls?.length || 0}
                  generationData={message.generationData}
                  openImageViewer={openImageViewer}
                  handleRemixImage={handleRemixImage}
                  handleUpscaleImage={handleUpscaleImage}
                />
              ))}
            </div>
            {message.generationData && (
              <GenerationDataLogger data={message.generationData} />
            )}
          </div>
        ) : message.isUser ? (
          // User message - no markdown
          <div className="text-right">
            {message.content}
          </div>
        ) : (
          // AI message - with markdown and latex
          <div className="prose dark:prose-invert max-w-none">
            <ContentRenderer content={message.content} />
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MessageItem; 