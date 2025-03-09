-- Enable the UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create glossary_terms table
CREATE TABLE IF NOT EXISTS public.glossary_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term VARCHAR(255) NOT NULL,
    explanation TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Uncategorized',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Add index on category for faster lookups when grouping
    CONSTRAINT glossary_terms_term_key UNIQUE (term)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS glossary_terms_category_idx ON public.glossary_terms (category);
CREATE INDEX IF NOT EXISTS glossary_terms_created_at_idx ON public.glossary_terms (created_at DESC);

-- Create a function to delete terms by ID (as an RPC fallback)
CREATE OR REPLACE FUNCTION public.delete_term_by_id(term_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    DELETE FROM public.glossary_terms WHERE id = term_id;
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to delete terms by text
CREATE OR REPLACE FUNCTION public.delete_term_by_text(term_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    DELETE FROM public.glossary_terms WHERE term = term_text;
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up Row Level Security (RLS)
ALTER TABLE public.glossary_terms ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow anonymous users to read terms
CREATE POLICY "Allow anonymous read" ON public.glossary_terms
    FOR SELECT USING (true);

-- Allow anonymous users to insert terms
CREATE POLICY "Allow anonymous insert" ON public.glossary_terms
    FOR INSERT WITH CHECK (true);

-- Allow anonymous users to update terms
CREATE POLICY "Allow anonymous update" ON public.glossary_terms
    FOR UPDATE USING (true);

-- Allow anonymous users to delete terms
CREATE POLICY "Allow anonymous delete" ON public.glossary_terms
    FOR DELETE USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.glossary_terms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.glossary_terms TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.delete_term_by_id TO anon;
GRANT EXECUTE ON FUNCTION public.delete_term_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_term_by_text TO anon;
GRANT EXECUTE ON FUNCTION public.delete_term_by_text TO authenticated; 