# Glossary Feature Setup

The glossary feature allows users to look up terms by selecting text on the page and displays a sidebar with previously looked-up terms grouped by category.

## Prerequisites

1. A Supabase account and project
2. Administrator access to run SQL in the Supabase dashboard

## Setup Instructions

### 1. Set Up Supabase Database

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase_schema.sql` from this project
4. Run the SQL to create the `glossary_terms` table and set up permissions

### 2. Configure Environment Variables

1. Create a `.env.local` file in the project root (based on `.env.example`)
2. Add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. You can find these values in your Supabase project dashboard under Settings > API

### 3. Install Dependencies

Run the following command to install the Supabase client:

```bash
npm install @supabase/supabase-js
# or
pnpm add @supabase/supabase-js
```

### 4. Testing the Feature

1. Start the application with `npm run dev` or `pnpm dev`
2. Select any text on the page
3. Click the lookup icon that appears
4. The term will be added to the glossary with a category
5. Check the right sidebar to see the glossary populated with terms

## How It Works

1. When a user selects text, the `TextSelectionLookup` component shows a lookup icon
2. When clicked, it sends a request to the AI with a prompt to explain the term and categorize it
3. The explanation is displayed in the chat, and the term is stored in Supabase
4. The `Glossary` component fetches terms from Supabase and displays them grouped by category

## Customization

- To modify the glossary display, edit `app/components/Glossary.tsx`
- To change how terms are categorized, edit the prompt in `app/hooks/useTextLookup.ts`
- To modify the database schema, update `supabase_schema.sql` and run the changes in your Supabase dashboard 