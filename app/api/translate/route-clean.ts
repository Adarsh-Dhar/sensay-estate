import { NextResponse } from 'next/server';
import { v2 as Translate } from '@google-cloud/translate';

// Instantiate the Google Cloud Translate client
// This will automatically use the credentials from the .env.local file
const translate = new Translate.Translate();

/**
 * This API route translates text from a source language to a target language.
 * @param {Request} request The incoming HTTP request.
 * @returns {NextResponse} A JSON response with the translation details.
 * @example
 * fetch('/api/translate', {
 * method: 'POST',
 * headers: { 'Content-Type': 'application/json' },
 * body: JSON.stringify({ text: 'नमस्ते दुनिया', sourceLang: 'hi', targetLang: 'en' })
 * })
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, sourceLang, targetLang = 'en' } = body; // Default target language is English

    // 1. --- Input Validation ---
    if (!text) {
      return NextResponse.json({ error: 'Text to translate is required' }, { status: 400 });
    }
    
    if (!sourceLang) {
      return NextResponse.json({ error: 'Source language is required' }, { status: 400 });
    }

    // Check if Google Cloud credentials are available
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_PROJECT) {
      return NextResponse.json({ 
        error: 'Translation service not configured. Please check Google Cloud credentials.',
        details: 'Missing GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_PROJECT environment variables'
      }, { status: 500 });
    }

    // 2. --- Translation Logic ---
    let detectedSourceLang = sourceLang;
    
    // If sourceLang is 'auto', detect the language first
    if (sourceLang === 'auto') {
      try {
        console.log(`[TranslateAPI] Detecting language for text: "${text}"`);
        const [detection] = await translate.detect(text);
        detectedSourceLang = detection.language;
        console.log(`[TranslateAPI] Auto-detected language: ${detectedSourceLang}`);
      } catch (detectError) {
        console.error('[TranslateAPI] Language detection error:', detectError);
        detectedSourceLang = 'en'; // Fallback to English
      }
    }
    
    // Optimization: If the source language is already the target language,
    // we don't need to make an expensive API call.
    if (detectedSourceLang === targetLang) {
      return NextResponse.json({
        originalText: text,
        translatedText: text,
        sourceLang: detectedSourceLang,
        translationRequired: false,
      });
    }

    // If translation is needed, call the Google Cloud Translate API
    console.log(`[TranslateAPI] Translating from ${detectedSourceLang} to ${targetLang}: "${text}"`);
    const [translation] = await translate.translate(text, {
      from: detectedSourceLang,
      to: targetLang,
    });
    console.log(`[TranslateAPI] Translation result: "${translation}"`);

    // 3. --- Send the Response ---
    return NextResponse.json({
      originalText: text,
      translatedText: translation,
      sourceLang: detectedSourceLang,
      translationRequired: true,
    });

  } catch (error) {
    console.error('[TranslateAPI] Translation API Error:', error);
    console.error('[TranslateAPI] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Provide more specific error messages
    let errorMessage = 'An internal server error occurred during translation.';
    if (error instanceof Error) {
      if (error.message.includes('credentials')) {
        errorMessage = 'Google Cloud credentials not configured properly.';
      } else if (error.message.includes('quota')) {
        errorMessage = 'Translation API quota exceeded.';
      } else if (error.message.includes('permission')) {
        errorMessage = 'Insufficient permissions for translation API.';
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Network error connecting to translation service.';
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
