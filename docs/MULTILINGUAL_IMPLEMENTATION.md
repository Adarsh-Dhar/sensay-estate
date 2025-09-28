# Multilingual Implementation Guide

## Overview

This document describes the hybrid internationalization (i18n) system implemented for the Neighborhood Navigator chat API. The system combines real-time translation for user input with a professional i18n framework for static responses, providing high-quality multilingual support without maintaining separate prompts for every language.

## Architecture

### High-Level Flow

```
User (in Hindi) → [Detect Language: Hindi] → Translate to English → [Your Existing English Prompt] → LLM → [JSON with English Content] → Your Backend → [Translate Dynamic Content to Hindi] OR [Lookup Static Text in hi.json] → User (in Hindi)
```

### Key Components

1. **Language Detection System** - Detects user language from multiple sources
2. **Input Translation Layer** - Translates user messages to English before processing
3. **i18n Framework** - Manages static text translations via locale files
4. **Output Translation Layer** - Translates LLM responses back to user language
5. **Translation API Integration** - Uses Google Cloud Translate for dynamic content

## Implementation Details

### 1. Language Detection (`lib/i18n.ts`)

The system detects user language through multiple sources in priority order:

1. **User Profile Language** - Stored in user profile/session
2. **Message Content Detection** - Analyzes text for language patterns
3. **Accept-Language Header** - Browser language preference
4. **Default Fallback** - English

```typescript
// Example usage
const userLanguage = getUserLanguage(
  req.headers.get('accept-language'), // "hi-IN,hi;q=0.9,en;q=0.8"
  "मुझे $500k के तहत घर दिखाओ", // User message
  "hi" // User profile language
)
// Returns: "hi"
```

### 2. Locale Files

Static text is managed through JSON locale files:

- `locales/en.json` - English (default)
- `locales/hi.json` - Hindi
- `locales/es.json` - Spanish

```json
{
  "greeting": "Hello! I'm your Personal Real Estate Analyst...",
  "calculating_yield": "Calculating rental yield and investment potential",
  "translation_result": "Translation Result"
}
```

### 3. Input Translation Layer

User messages are automatically translated to English before processing:

```typescript
// User sends: "मुझे $500k के तहत घर दिखाओ"
// System translates to: "show me houses under $500k"
// Then processes with existing English prompts
```

### 4. Output Translation Layer

LLM responses are translated back to the user's language:

```typescript
// LLM returns: {"action": "reply", "content": "The investment score is 6/10..."}
// System translates to: {"action": "reply", "content": "निवेश स्कोर 6/10 है..."}
```

## Usage Examples

### Example 1: Hindi User Query

**User Input:**
```
मुझे $500k के तहत घर दिखाओ
```

**System Processing:**
1. Detects language: `hi` (Hindi)
2. Translates input: `show me houses under $500k`
3. Processes with English prompts
4. LLM returns: `{"action": "search", "filters": {...}}`
5. Translates response back to Hindi

**User Response:**
```
मैंने आपके लिए $500k के तहत घरों की खोज की है...
```

### Example 2: Spanish Translation Request

**User Input:**
```
traducir "investment analysis"
```

**System Processing:**
1. Detects as translation request
2. Extracts text: `"investment analysis"`
3. Translates to Spanish: `"análisis de inversión"`
4. Returns formatted translation result

**User Response:**
```
🌐 **Resultado de Traducción**

**Texto Original (en):** investment analysis

**Texto Traducido (Español):** análisis de inversión

✅ Traducción completada exitosamente
```

### Example 3: English User (No Translation)

**User Input:**
```
What's the rental yield?
```

**System Processing:**
1. Detects language: `en` (English)
2. No input translation needed
3. Processes normally
4. No output translation needed

## API Response Structure

The chat API now returns enhanced response data:

```typescript
{
  "success": true,
  "data": {
    "action": "reply",
    "content": "Translated response in user's language",
    "userLanguage": "hi",
    "inputTranslation": {
      "originalText": "मुझे $500k के तहत घर दिखाओ",
      "translatedText": "show me houses under $500k",
      "detectedLang": "hi",
      "targetLang": "en"
    },
    "outputTranslation": {
      "originalText": "I found houses under $500k for you...",
      "translatedText": "मैंने आपके लिए $500k के तहत घरों की खोज की है...",
      "detectedLang": "en",
      "targetLang": "hi"
    }
  }
}
```

## Supported Languages

Currently supported languages:

- **English (en)** - Default
- **Hindi (hi)** - हिन्दी
- **Spanish (es)** - Español

## Adding New Languages

To add a new language (e.g., French):

1. **Create locale file:**
   ```bash
   # Create locales/fr.json
   {
     "greeting": "Bonjour! Je suis votre Analyste Immobilier Personnel...",
     "help": "Je suis là pour être votre Analyste Immobilier Personnel!...",
     // ... other keys
   }
   ```

2. **Update supported languages:**
   ```typescript
   // In lib/i18n.ts
   export const SUPPORTED_LANGUAGES = ['en', 'hi', 'es', 'fr'] as const
   ```

3. **Add language detection patterns:**
   ```typescript
   const LANGUAGE_PATTERNS = {
     // ... existing patterns
     fr: /\b(bonjour|merci|s'il vous plaît|maisons|appartements|prix)\b/i,
   }
   ```

4. **Add language name:**
   ```typescript
   const names: Record<SupportedLanguage, string> = {
     // ... existing names
     fr: 'Français'
   }
   ```

## Configuration

### Environment Variables

Ensure these are set in your `.env.local`:

```bash
# Google Cloud Translate API
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
# OR
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Sensay API
SENSAY_API_KEY=your-sensay-api-key
```

### Translation API Setup

The system uses Google Cloud Translate API. Set up:

1. Enable Google Cloud Translate API
2. Create service account with Translate API access
3. Download credentials JSON file
4. Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable

## Performance Considerations

- **Caching**: Locale files are cached in memory for performance
- **Translation Caching**: Consider implementing Redis cache for frequent translations
- **Batch Translation**: For multiple messages, consider batch translation API calls
- **Fallback Strategy**: System gracefully falls back to English if translation fails

## Error Handling

The system includes comprehensive error handling:

- **Translation Failures**: Falls back to original text
- **Missing Locale Files**: Falls back to English
- **API Errors**: Graceful degradation with user-friendly messages
- **Language Detection Failures**: Defaults to English

## Testing

Test the multilingual system:

```bash
# Test Hindi input
curl -X POST /api/chat \
  -H "Accept-Language: hi-IN,hi;q=0.9,en;q=0.8" \
  -d '{"message": "मुझे $500k के तहत घर दिखाओ"}'

# Test Spanish input
curl -X POST /api/chat \
  -H "Accept-Language: es-ES,es;q=0.9" \
  -d '{"message": "¿Cuál es el rendimiento de alquiler?"}'

# Test translation request
curl -X POST /api/chat \
  -d '{"message": "traducir investment analysis"}'
```

## Benefits

1. **Preserves Core Logic**: No need to modify complex English prompts
2. **High-Quality UX**: Professional translations for static text
3. **Scalable**: Easy to add new languages
4. **Cost-Effective**: Cheaper than maintaining separate prompts
5. **Reliable**: Graceful fallbacks ensure system always works

## Future Enhancements

- **Language Preferences**: User can set preferred language in profile
- **Translation Memory**: Cache common translations for better performance
- **Context-Aware Translation**: Use property context for better translations
- **Voice Support**: Extend to voice-based interactions
- **Real-time Language Switching**: Allow users to switch languages mid-conversation
