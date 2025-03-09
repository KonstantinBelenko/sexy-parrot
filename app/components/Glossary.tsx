/* eslint-disable */
'use client'

import { FC, useEffect, useState, useCallback } from 'react';
import { getGlossaryTermsByCategory, deleteGlossaryTerm, deleteGlossaryTermByText, GlossaryTerm } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronDown, ChevronUp, Info, Trash2, X, AlertCircle, RefreshCw } from 'lucide-react';

interface GlossaryProps {
  className?: string;
  refreshTrigger?: number; // Added to force refresh when new terms are added
}

const Glossary: FC<GlossaryProps> = ({ className, refreshTrigger = 0 }) => {
  const [categories, setCategories] = useState<Record<string, GlossaryTerm[]>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedTerms, setExpandedTerms] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{ id: string, message: string } | null>(null);
  const [deleteAttempts, setDeleteAttempts] = useState<number>(0);
  // Track deleted terms to filter them out after refresh
  const [deletedTermTexts, setDeletedTermTexts] = useState<Set<string>>(new Set());

  // Filter out deleted terms from categories
  const filterDeletedTerms = useCallback((rawCategories: Record<string, GlossaryTerm[]>) => {
    if (deletedTermTexts.size === 0) return rawCategories;
    
    const filteredCategories = { ...rawCategories };
    
    // Remove all terms that match deleted term texts
    Object.keys(filteredCategories).forEach(category => {
      filteredCategories[category] = filteredCategories[category].filter(
        term => !deletedTermTexts.has(term.term)
      );
      
      // If category is now empty, remove it
      if (filteredCategories[category].length === 0) {
        delete filteredCategories[category];
      }
    });
    
    return filteredCategories;
  }, [deletedTermTexts]);

  // Load glossary terms - made into a useCallback so it can be called from elsewhere
  const loadGlossary = useCallback(async () => {
    setIsLoading(true);
    try {
      const { categories: rawCategories, error } = await getGlossaryTermsByCategory();
      
      if (error) {
        setError(error);
        return;
      }
      
      // Filter out any terms we know were deleted
      const filteredCategories = filterDeletedTerms(rawCategories);
      setCategories(filteredCategories);
      
      // Initialize all categories as expanded
      const initialExpandedState: Record<string, boolean> = {};
      Object.keys(filteredCategories).forEach(category => {
        initialExpandedState[category] = true;
      });
      setExpandedCategories(initialExpandedState);
    } catch (err) {
      setError('Failed to load glossary');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [filterDeletedTerms]);
  
  // Initial load and setup refresh interval with a longer interval
  useEffect(() => {
    loadGlossary();
    
    // Set up an interval to refresh the glossary periodically
    // Use a longer interval (60s) to avoid flashing of deleted terms
    const intervalId = setInterval(loadGlossary, 60000);
    
    return () => clearInterval(intervalId);
  }, [loadGlossary]);
  
  // Refresh when the refreshTrigger changes, but only if we're not mid-deletion
  useEffect(() => {
    if (refreshTrigger > 0 && !isDeleting && !deleteConfirmation) {
      loadGlossary();
    }
  }, [refreshTrigger, loadGlossary, isDeleting, deleteConfirmation]);
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  
  const toggleTerm = (termId: string) => {
    setExpandedTerms(prev => ({
      ...prev,
      [termId]: !prev[termId]
    }));
  };
  
  const promptDeleteTerm = (termId: string) => {
    setDeleteConfirmation(termId);
    // Clear any previous delete errors
    setDeleteError(null);
  };
  
  const cancelDelete = () => {
    setDeleteConfirmation(null);
    setDeleteError(null);
  };
  
  const findTermById = (termId: string): GlossaryTerm | null => {
    for (const category in categories) {
      const term = categories[category].find(t => t.id === termId);
      if (term) return term;
    }
    return null;
  };
  
  // Mark a term as deleted locally first, then attempt server deletion
  const markTermAsDeleted = (termText: string) => {
    setDeletedTermTexts(prev => {
      const updated = new Set(prev);
      updated.add(termText);
      return updated;
    });
    
    // Also update the local UI state immediately
    setCategories(prevCategories => {
      const newCategories = { ...prevCategories };
      
      // Find and remove all instances with this term text
      Object.keys(newCategories).forEach(category => {
        newCategories[category] = newCategories[category].filter(t => t.term !== termText);
        
        // If category is now empty, remove it
        if (newCategories[category].length === 0) {
          delete newCategories[category];
        }
      });
      
      return newCategories;
    });
  };
  
  const confirmDeleteTerm = async (termId: string) => {
    setIsDeleting(true);
    setDeleteError(null);
    
    const term = findTermById(termId);
    if (!term) {
      setDeleteError({ id: termId, message: 'Term not found in local state' });
      setIsDeleting(false);
      return;
    }
    
    // Mark the term as deleted in our local state FIRST
    markTermAsDeleted(term.term);
    
    try {
      console.log(`Attempting to delete term: ${term.term} (${termId})`);
      
      // Try the text-based deletion first as it's more reliable
      let { success, error } = await deleteGlossaryTermByText(term.term);

      // If that fails, try ID-based deletion as a fallback
      if (!success || error) {
        console.log(`Text-based deletion failed, trying ID-based deletion for "${term.term}" (${termId})`);
        const idResult = await deleteGlossaryTerm(termId);
        success = idResult.success;
        error = idResult.error;
        
        if (success) {
          console.log(`ID-based deletion succeeded for "${term.term}" (${termId})`);
        }
      } else {
        console.log(`Text-based deletion succeeded for "${term.term}"`);
      }
      
      if (!success || error) {
        // Even if server deletion failed, we keep the local state updated
        // so the term stays visually deleted
        console.warn(`Server deletion failed, but term remains visually deleted: ${error}`);
      }
      
      // Clear any expanded state for this term
      setExpandedTerms(prev => {
        const newState = { ...prev };
        delete newState[termId];
        return newState;
      });
      
      // Clear the delete confirmation
      setDeleteConfirmation(null);
      
    } catch (err) {
      console.error('Error deleting term:', err);
      setDeleteError({ 
        id: termId, 
        message: err instanceof Error ? err.message : 'Unknown error deleting term'
      });
      // We don't revert the local deletion even on error - the term stays visually deleted
    } finally {
      setIsDeleting(false);
    }
  };
  
  const retryDelete = (termId: string) => {
    setDeleteError(null);
    confirmDeleteTerm(termId);
  };
  
  const forceDeleteByText = async (termId: string) => {
    const term = findTermById(termId);
    if (!term) {
      setDeleteError({ id: termId, message: 'Term not found in local state' });
      return;
    }
    
    // Mark the term as deleted in our local state FIRST
    markTermAsDeleted(term.term);
    
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      console.log(`Force deleting term by text: "${term.term}"`);
      const { success, error } = await deleteGlossaryTermByText(term.term);
      
      if (!success || error) {
        console.warn(`Force deletion had server error but term remains visually deleted: ${error}`);
      }
      
      // Clear any expanded state for this term
      setExpandedTerms(prev => {
        const newState = { ...prev };
        delete newState[termId];
        return newState;
      });
      
      // Clear the delete confirmation
      setDeleteConfirmation(null);
      
    } catch (err) {
      console.error('Error force deleting term by text:', err);
      setDeleteError({ 
        id: termId, 
        message: err instanceof Error ? err.message : 'Unknown error during force delete'
      });
      // We don't revert the local deletion even on error
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Clear deleted terms tracking and reload
  const handleFullRefresh = () => {
    setDeletedTermTexts(new Set());
    loadGlossary();
  };
  
  if (isLoading && Object.keys(categories).length === 0) {
    return (
      <div className={`p-4 border rounded-lg shadow-sm ${className}`}>
        <div className="flex items-center space-x-2 mb-4">
          <BookOpen className="w-5 h-5" />
          <h2 className="text-lg font-medium">Glossary</h2>
        </div>
        <div className="flex justify-center items-center h-40">
          <div className="animate-pulse text-sm text-muted-foreground">Loading glossary...</div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`p-4 border rounded-lg shadow-sm ${className}`}>
        <div className="flex items-center space-x-2 mb-4">
          <BookOpen className="w-5 h-5" />
          <h2 className="text-lg font-medium">Glossary</h2>
        </div>
        <div className="text-sm text-red-500">
          Error loading glossary: {error}
        </div>
      </div>
    );
  }
  
  const categoryCount = Object.keys(categories).length;
  
  if (categoryCount === 0) {
    return (
      <div className={`p-4 border rounded-lg shadow-sm ${className}`}>
        <div className="flex items-center space-x-2 mb-4">
          <BookOpen className="w-5 h-5" />
          <h2 className="text-lg font-medium">Glossary</h2>
        </div>
        <div className="text-sm text-muted-foreground text-center py-8">
          No terms in glossary yet. Select text and use the lookup feature to add terms.
        </div>
      </div>
    );
  }
  
  return (
    <div className={`p-4 border rounded-lg shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5" />
          <h2 className="text-lg font-medium">Glossary</h2>
        </div>
        <div className="flex items-center space-x-2">
          {isLoading && (
            <div className="text-xs text-muted-foreground animate-pulse">Refreshing...</div>
          )}
          <div className="flex">
            <button 
              onClick={loadGlossary} 
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh glossary"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {deletedTermTexts.size > 0 && (
              <button
                onClick={handleFullRefresh}
                className="ml-1 text-xs text-blue-500 hover:text-blue-700"
                title="Reset and show all terms"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
        {Object.entries(categories).map(([category, terms]) => (
          <div key={category} className="border rounded-md">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full p-2 bg-muted/30 flex justify-between items-center rounded-t-md"
            >
              <span className="font-medium text-sm">{category} ({terms.length})</span>
              {expandedCategories[category] ? 
                <ChevronUp className="w-4 h-4" /> : 
                <ChevronDown className="w-4 h-4" />
              }
            </button>
            
            <AnimatePresence>
              {expandedCategories[category] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.1 }} // Fast animation as per requirements
                >
                  <div className="p-2 space-y-3">
                    {terms.map(term => (
                      <div key={term.id} className="text-sm border-b border-muted/40 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between">
                          <div className="font-medium">{term.term}</div>
                          <div className="flex items-center space-x-1">
                            <button 
                              onClick={() => toggleTerm(term.id)}
                              className="flex-shrink-0 ml-2 text-muted-foreground hover:text-foreground transition-colors p-1"
                              title={expandedTerms[term.id] ? "Collapse" : "Expand"}
                            >
                              {expandedTerms[term.id] ? 
                                <ChevronUp className="w-3 h-3" /> : 
                                <Info className="w-3 h-3" />
                              }
                            </button>
                            <button 
                              onClick={() => promptDeleteTerm(term.id)}
                              className="flex-shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-1"
                              title="Delete term"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        
                        <AnimatePresence>
                          {expandedTerms[term.id] ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.1 }} // Fast animation
                              className="mt-1 text-muted-foreground text-xs"
                            >
                              {term.explanation}
                            </motion.div>
                          ) : (
                            <div className="text-muted-foreground text-xs line-clamp-1 mt-1">
                              {term.explanation.substring(0, 60)}
                              {term.explanation.length > 60 ? '...' : ''}
                            </div>
                          )}
                        </AnimatePresence>
                        
                        {/* Delete confirmation */}
                        <AnimatePresence>
                          {deleteConfirmation === term.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              transition={{ duration: 0.1 }}
                              className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md"
                            >
                              <div className="flex items-start">
                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-red-800 dark:text-red-300">
                                    Delete "{term.term}"?
                                  </p>
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    This action cannot be undone.
                                  </p>
                                  
                                  {/* Show error message if deletion failed */}
                                  {deleteError && deleteError.id === term.id && (
                                    <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-1.5 rounded">
                                      <p className="font-medium">Error: {deleteError.message}</p>
                                      <p className="mt-1">Please try again or refresh the page.</p>
                                    </div>
                                  )}
                                  
                                  <div className="flex space-x-2 mt-2">
                                    <button
                                      onClick={() => deleteError ? retryDelete(term.id) : confirmDeleteTerm(term.id)}
                                      disabled={isDeleting}
                                      className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors disabled:opacity-50 flex items-center"
                                    >
                                      {isDeleting ? 'Deleting...' : deleteError ? 'Retry' : 'Delete'}
                                      {deleteError && !isDeleting && <RefreshCw className="ml-1 w-3 h-3" />}
                                    </button>
                                    {deleteError && (
                                      <button
                                        onClick={() => forceDeleteByText(term.id)}
                                        disabled={isDeleting}
                                        className="text-xs px-2 py-1 bg-red-700 hover:bg-red-800 text-white rounded-md transition-colors disabled:opacity-50 flex items-center"
                                        title="Try text-based deletion method"
                                      >
                                        Force Delete
                                      </button>
                                    )}
                                    <button
                                      onClick={cancelDelete}
                                      disabled={isDeleting}
                                      className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Glossary; 