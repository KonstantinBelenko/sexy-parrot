# ACET - AI Chat with Enhanced Tools

ACET is a chat application with enhanced tools for AI-powered text and image generation.

## Features

- Text chat with AI using Groq API
- Voice input with automatic transcription 
- Image generation with Civitai's stable diffusion models
- Support for multiple model selection
- Drag and drop image upload
- Responsive UI with dark/light mode

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   cd python_backend
   pip install -r requirements.txt
   ```
3. Create environment files:
   - Create `.env.local` in the root for frontend
   - Create `.env` in the python_backend directory for backend

4. Get API keys:
   - Groq API key: https://console.groq.com/
   - Civitai API token: https://civitai.com/user/account

5. Add your API keys to the environment files:
   ```
   # In python_backend/.env
   GROQ_API_KEY=your_groq_api_key
   CIVITAI_API_TOKEN=your_civitai_api_token
   ```

6. Start the backend:
   ```
   cd python_backend
   uvicorn app.main:app --reload
   ```

7. Start the frontend:
   ```
   npm run dev
   ```

8. Open http://localhost:3000 in your browser

## Image Generation

This application uses Civitai's API for image generation. The following models are available:

- SD 1.5: Balanced quality and speed
- SDXL: Higher quality, slower generation
- Realistic Vision: Specialized for realistic images
- DreamShaper: Creative and artistic outputs

To generate images, simply type a prompt that describes the image, or ask the AI to create an image for you.

## Development

This project uses:
- Next.js for the frontend
- FastAPI for the backend
- ShadcnUI for the UI components
- Framer Motion for animations

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
