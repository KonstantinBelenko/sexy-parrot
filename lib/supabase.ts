import { createClient } from '@supabase/supabase-js';

// Define the database types
export type GlossaryTerm = {
  id: string;
  term: string;
  explanation: string;
  category: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      glossary_terms: {
        Row: GlossaryTerm;
        Insert: Omit<GlossaryTerm, 'id' | 'created_at'>;
        Update: Partial<Omit<GlossaryTerm, 'id' | 'created_at'>>;
      };
    };
  };
};

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create and export the typed Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Log current Supabase configuration (without exposing full keys)
console.log(`Supabase URL: ${supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : 'Not configured'}`);
console.log(`Supabase Key: ${supabaseAnonKey ? 'Set (first 5 chars: ' + supabaseAnonKey.substring(0, 5) + '...)' : 'Not configured'}`);

// Helper function to add a term to the glossary
export async function addTermToGlossary(
  term: string,
  explanation: string,
  category: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('glossary_terms').insert({
      term,
      explanation,
      category,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error adding term to glossary:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Helper function to delete a term from the glossary by term text
export async function deleteGlossaryTermByText(
  termText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Attempting to delete term with text: "${termText}"`);
    
    // First try using the RPC function which bypasses some RLS issues
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('delete_term_by_text', {
        term_text: termText
      });
      
      if (!rpcError && rpcResult === true) {
        console.log(`Successfully deleted term "${termText}" using RPC function`);
        return { success: true };
      }
      
      // If RPC fails, log the error but continue with the regular approach
      if (rpcError) {
        console.warn(`RPC deletion failed: ${rpcError.message}. Trying standard deletion.`);
      }
    } catch (rpcErr) {
      console.warn('Error with RPC call:', rpcErr);
      // Continue with standard deletion
    }
    
    // Standard deletion approach
    // First find the term by its text
    const { data: terms, error: fetchError } = await supabase
      .from('glossary_terms')
      .select('*')
      .eq('term', termText);
    
    if (fetchError) {
      console.error('Error fetching term to delete by text:', fetchError);
      throw new Error(`Term lookup failed: ${fetchError.message}`);
    }
    
    if (!terms || terms.length === 0) {
      throw new Error(`Term "${termText}" not found in database`);
    }
    
    console.log(`Found ${terms.length} terms matching "${termText}":`, terms);
    
    // Delete all matching terms
    let deletedCount = 0;
    for (const term of terms) {
      console.log(`Attempting to delete individual term ID: ${term.id}`);
      
      // Try direct SQL deletion through RPC
      try {
        const { data: rpcResult, error: directError } = await supabase.rpc('delete_term_by_id', {
          term_id: term.id
        });
        
        if (!directError && rpcResult === true) {
          console.log(`Successfully deleted term ID ${term.id} using RPC`);
          deletedCount++;
          continue;
        }
        
        if (directError) {
          console.warn(`Direct RPC deletion failed for ID ${term.id}: ${directError.message}`);
        }
      } catch (directErr) {
        console.warn(`Error with direct RPC deletion for ID ${term.id}:`, directErr);
      }
      
      // If RPC fails, try regular delete
      const { error: deleteError } = await supabase
        .from('glossary_terms')
        .delete()
        .eq('id', term.id);
      
      if (deleteError) {
        console.error(`Error deleting term ${term.id}:`, deleteError);
      } else {
        console.log(`Successfully deleted term ID ${term.id} using standard delete`);
        deletedCount++;
      }
    }
    
    if (deletedCount === 0) {
      throw new Error(`Failed to delete any instances of term "${termText}"`);
    }
    
    console.log(`Successfully deleted ${deletedCount} instances of term "${termText}"`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting glossary term by text:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Helper function to delete a term from the glossary by ID
export async function deleteGlossaryTerm(
  termId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Attempting to delete term with ID: ${termId}`);
    
    // Try RPC method first (most reliable)
    try {
      // Format UUID correctly if it's not already in the right format
      // Some UUIDs need to be standardized to work in Postgres
      let formattedId = termId;
      if (!termId.includes('-') && termId.length === 32) {
        // Convert 32-char string to UUID format with hyphens
        formattedId = `${termId.slice(0, 8)}-${termId.slice(8, 12)}-${termId.slice(12, 16)}-${termId.slice(16, 20)}-${termId.slice(20)}`;
        console.log(`Reformatted UUID: ${termId} -> ${formattedId}`);
      }
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('delete_term_by_id', {
        term_id: formattedId
      });
      
      if (!rpcError && rpcResult === true) {
        console.log(`Successfully deleted term ID ${formattedId} using RPC`);
        return { success: true };
      }
      
      if (rpcError) {
        console.warn(`RPC deletion failed: ${rpcError.message}. Trying standard methods.`);
      }
    } catch (rpcErr) {
      console.warn('Error with RPC call:', rpcErr);
      // Continue with standard methods
    }
    
    // First verify the term exists
    const { data: termData, error: fetchError } = await supabase
      .from('glossary_terms')
      .select('*')
      .eq('id', termId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching term to delete:', fetchError);
      
      // Try UUID variations if fetch fails
      const variations = [
        termId,
        termId.toLowerCase(),
        termId.toUpperCase(),
        // Add/remove dashes
        termId.includes('-') ? termId.replace(/-/g, '') : 
        `${termId.slice(0, 8)}-${termId.slice(8, 12)}-${termId.slice(12, 16)}-${termId.slice(16, 20)}-${termId.slice(20, 32)}`,
      ];
      
      console.log(`Trying UUID variations:`, variations);
      
      // Try each variation
      for (const variation of variations) {
        try {
          const { data: tryData, error: tryError } = await supabase
            .from('glossary_terms')
            .select('id, term')
            .eq('id', variation)
            .maybeSingle();
          
          if (!tryError && tryData) {
            console.log(`Found term with UUID variation: ${variation}`, tryData);
            // Try to delete with this variation
            const { error: deleteError } = await supabase
              .from('glossary_terms')
              .delete()
              .eq('id', variation);
            
            if (!deleteError) {
              console.log(`Successfully deleted with UUID variation: ${variation}`);
              return { success: true };
            }
          }
        } catch (e) {
          console.warn(`Error trying UUID variation ${variation}:`, e);
        }
      }
      
      // If we get a "not found" error, try to debug by listing all terms
      const { data: allTerms } = await supabase
        .from('glossary_terms')
        .select('id, term')
        .limit(10);
      
      console.log('Available terms in database:', allTerms);
      
      // Try to delete by direct SQL as a fallback
      try {
        const { error: rpcError } = await supabase.rpc('delete_term_by_id', { term_id: termId });
        if (rpcError) {
          console.error('RPC deletion failed:', rpcError);
          throw new Error(`Term lookup failed: ${fetchError.message}`);
        } else {
          console.log('Term might have been deleted using RPC method');
          return { success: true };
        }
      } catch (rpcErr) {
        console.error('Error with RPC fallback:', rpcErr);
        throw new Error(`Term lookup failed: ${fetchError.message}`);
      }
    }
    
    if (!termData) {
      throw new Error('Term not found');
    }
    
    console.log(`Found term to delete:`, termData);
    
    // Proceed with deletion
    const { error, count } = await supabase
      .from('glossary_terms')
      .delete({ count: 'exact' })
      .eq('id', termId);
    
    if (error) {
      console.error('Supabase deletion error:', error);
      throw error;
    }
    
    // Verify something was actually deleted
    if (count === 0) {
      console.warn(`No rows deleted for ID: ${termId}`);
      
      // One last try - attempt raw SQL execution through RPC
      try {
        const { error: directError } = await supabase.rpc('delete_term_by_id', {
          term_id: termId
        });
        
        if (directError) {
          console.error('Final RPC attempt failed:', directError);
          throw new Error('Term could not be deleted - no rows affected');
        } else {
          console.log('Term might have been deleted in final RPC attempt');
          return { success: true };
        }
      } catch (finalErr) {
        console.error('Error in final deletion attempt:', finalErr);
        throw new Error('Term could not be deleted - no rows affected after all attempts');
      }
    }
    
    console.log(`Successfully deleted term ID: ${termId}, rows affected: ${count}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting glossary term:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Helper function to get all glossary terms
export async function getGlossaryTerms(): Promise<{ 
  terms: GlossaryTerm[]; 
  error?: string 
}> {
  try {
    const { data, error } = await supabase
      .from('glossary_terms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { terms: data || [] };
  } catch (error) {
    console.error('Error fetching glossary terms:', error);
    return { 
      terms: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Helper function to get glossary terms grouped by category
export async function getGlossaryTermsByCategory(): Promise<{ 
  categories: Record<string, GlossaryTerm[]>; 
  error?: string 
}> {
  try {
    const { terms, error } = await getGlossaryTerms();
    
    if (error) throw new Error(error);
    
    // Group terms by category
    const groupedTerms = terms.reduce<Record<string, GlossaryTerm[]>>((acc, term) => {
      const category = term.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(term);
      return acc;
    }, {});
    
    return { categories: groupedTerms };
  } catch (error) {
    console.error('Error grouping glossary terms:', error);
    return { 
      categories: {}, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
} 