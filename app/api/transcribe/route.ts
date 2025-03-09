import { NextRequest, NextResponse } from 'next/server'

// Get the API key from environment variables
const groqApiKey = process.env.GROQ_API_KEY

export async function POST(req: NextRequest) {
  try {
    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured' },
        { status: 500 }
      )
    }

    // Process the multipart form data to get the audio file
    const formData = await req.formData()
    const audioFile = formData.get('file') as Blob
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }
    
    console.log(`Received audio file: size=${audioFile.size}, type=${audioFile.type}`)
    
    // Create a form data for the Groq API directly using the blob
    const formDataToSend = new FormData()
    
    // Use the blob directly without any conversion
    // Whisper accepts webm files directly
    formDataToSend.append('file', audioFile, 'audio.webm')
    formDataToSend.append('model', 'whisper-large-v3')
    
    // Send the request to Groq Whisper API
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: formDataToSend,
    })
    
    // Get the response as text first to debug if needed
    const responseText = await response.text()
    
    if (!response.ok) {
      console.error(`Groq API error (${response.status}):`, responseText)
      return NextResponse.json(
        { 
          error: `Groq API error: ${response.statusText}`,
          details: responseText
        },
        { status: response.status }
      )
    }
    
    // Try to parse the response as JSON
    try {
      const data = JSON.parse(responseText)
      return NextResponse.json(data)
    } catch (e) {
      console.error('Error parsing JSON response:', e, 'Response was:', responseText)
      return NextResponse.json(
        { error: 'Invalid JSON from Groq API', details: responseText.substring(0, 500) },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Error in transcribe API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
} 