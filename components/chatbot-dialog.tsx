"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  originalContent?: string
  language?: string
}

// Google Translate supported languages
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文 (简体)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '中文 (繁體)' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာ' },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ' },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'zu', name: 'Zulu', nativeName: 'IsiZulu' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskera' },
  { code: 'be', name: 'Belarusian', nativeName: 'Беларуская' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg' },
  { code: 'eo', name: 'Esperanto', nativeName: 'Esperanto' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino' },
  { code: 'haw', name: 'Hawaiian', nativeName: 'ʻŌlelo Hawaiʻi' },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen' },
  { code: 'hmn', name: 'Hmong', nativeName: 'Hmoob' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'jw', name: 'Javanese', nativeName: 'Basa Jawa' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақ' },
  { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча' },
  { code: 'lb', name: 'Luxembourgish', nativeName: 'Lëtzebuergesch' },
  { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy' },
  { code: 'mi', name: 'Maori', nativeName: 'Te Reo Māori' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол' },
  { code: 'ny', name: 'Chichewa', nativeName: 'Chichewa' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو' },
  { code: 'sm', name: 'Samoan', nativeName: 'Gagana Samoa' },
  { code: 'sn', name: 'Shona', nativeName: 'ChiShona' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali' },
  { code: 'su', name: 'Sundanese', nativeName: 'Basa Sunda' },
  { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbek' },
  { code: 'xh', name: 'Xhosa', nativeName: 'IsiXhosa' },
  { code: 'yi', name: 'Yiddish', nativeName: 'ייִדיש' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' }
]

type ChatbotDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  initialPrompt?: string
  userId?: string
  replicaUuid?: string
  projectId?: string
  projectContext?: Record<string, any>
  className?: string
}

function extractAssistantText(data: any): string {
  if (!data) return ""
  
  // If data has a content field, return it directly
  if (data.content && typeof data.content === "string") {
    return data.content
  }
  
  // Try common shapes; fallback to JSON string
  const candidates: Array<any> = [
    data?.message?.content,
    data?.content,
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.text,
    data?.reply?.content,
  ]
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c
  }
  
  // If it's an object with action, return the whole object as JSON
  if (typeof data === "object" && data.action) {
    try {
      return JSON.stringify(data)
    } catch {
      return String(data)
    }
  }
  
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

function isSearchResponse(data: any): boolean {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    return parsed?.action === 'search' && parsed?.redirect_url
  } catch {
    return false
  }
}

function isYieldResponse(data: any): boolean {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    return parsed?.action === 'calculate_yield' && parsed?.content
  } catch {
    return false
  }
}

function isReviewsResponse(data: any): boolean {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    return parsed?.action === 'get_reviews' && parsed?.content
  } catch {
    return false
  }
}


function getSearchResponseData(data: any): { redirectUrl: string; location?: string } | null {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    if (parsed?.action === 'search' && parsed?.redirect_url) {
      return {
        redirectUrl: parsed.redirect_url,
        location: parsed.filters?.location
      }
    }
  } catch {
    // Not a valid search response
  }
  return null
}

function getYieldResponseData(data: any): { content: string; latitude?: number; longitude?: number; propertyPrice?: number; hoaFees?: number } | null {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    if (parsed?.action === 'calculate_yield' && parsed?.content) {
      return {
        content: parsed.content,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        propertyPrice: parsed.propertyPrice,
        hoaFees: parsed.hoaFees
      }
    }
  } catch {
    // Not a valid yield response
  }
  return null
}

function getReviewsResponseData(data: any): { content: string; location?: string } | null {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    if (parsed?.action === 'get_reviews' && parsed?.content) {
      return {
        content: parsed.content,
        location: parsed.location
      }
    }
  } catch {
    // Not a valid reviews response
  }
  return null
}


export function ChatbotDialog({
  open,
  onOpenChange,
  title = "Ask AI",
  description = "Ask questions about this listing or neighborhood.",
  initialPrompt,
  userId,
  replicaUuid,
  projectId,
  projectContext,
  className,
}: ChatbotDialogProps) {
  const [messageInput, setMessageInput] = useState<string>("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string>("")
  const [translating, setTranslating] = useState<boolean>(false)
  const [languageSelected, setLanguageSelected] = useState<boolean>(false)
  const [fetchingReviews, setFetchingReviews] = useState<boolean>(false)
  const endRef = useRef<HTMLDivElement | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)

  // Translation function
  const translateText = useCallback(async (text: string, sourceLang: string, targetLang: string): Promise<string> => {
    console.log(`[Translation] Starting translation: "${text}" from ${sourceLang} to ${targetLang}`)
    
    if (sourceLang === targetLang) {
      console.log(`[Translation] Same language, no translation needed`)
      return text
    }
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang, targetLang })
      })
      
      if (!response.ok) {
        console.error(`[Translation] API error: ${response.status}`)
        const errorData = await response.json().catch(() => ({}))
        console.error(`[Translation] Error details:`, errorData)
        throw new Error(`Translation failed: ${errorData.error || 'Unknown error'}`)
      }
      
      const data = await response.json()
      console.log(`[Translation] API response:`, data)
      const translatedText = data.translatedText || text
      console.log(`[Translation] Final result: "${translatedText}"`)
      return translatedText
    } catch (error) {
      console.error('[Translation] Error:', error)
      
      // Simple fallback translations for common cases
      if (sourceLang === 'es' && targetLang === 'en') {
        const fallbackTranslations: Record<string, string> = {
          '¿dónde se encuentra esta propiedad?': 'where is this property located?',
          '¿dónde está esta propiedad?': 'where is this property?',
          'ubicación de la propiedad': 'property location',
          'dirección': 'address',
          'localización': 'location'
        }
        const lowerText = text.toLowerCase().trim()
        const fallback = fallbackTranslations[lowerText]
        if (fallback) {
          console.log(`[Translation] Using fallback: "${text}" -> "${fallback}"`)
          return fallback
        }
      }
      
      if (sourceLang === 'en' && targetLang === 'es') {
        const fallbackTranslations: Record<string, string> = {
          'where is this property located?': '¿dónde se encuentra esta propiedad?',
          'where is this property?': '¿dónde está esta propiedad?',
          'property location': 'ubicación de la propiedad',
          'address': 'dirección',
          'location': 'localización',
          'location information not available for this property': 'información de ubicación no disponible para esta propiedad'
        }
        const lowerText = text.toLowerCase().trim()
        const fallback = fallbackTranslations[lowerText]
        if (fallback) {
          console.log(`[Translation] Using fallback: "${text}" -> "${fallback}"`)
          return fallback
        }
      }
      
      console.log(`[Translation] No fallback available, returning original text`)
      return text // Fallback to original text
    }
  }, [])

  // Auto-detect language function using Google Translate
  const detectLanguage = useCallback(async (text: string): Promise<string> => {
    console.log(`[LanguageDetection] Starting detection for: "${text}"`)
    
    // First, try simple pattern matching for common Spanish phrases
    const spanishPatterns = [
      /¿[^?]*\?/g, // Spanish question marks
      /dónde|cuándo|cómo|qué|quién|por qué|para qué/g, // Spanish question words
      /está|están|estoy|estamos|estáis|están/g, // Spanish verb forms
      /propiedad|ubicación|dirección|localización/g, // Spanish property terms
      /[ñáéíóúüçàèìòùâêîôûäëïöü]/g // Spanish accented characters
    ]
    
    const hasSpanishPatterns = spanishPatterns.some(pattern => pattern.test(text))
    console.log(`[LanguageDetection] Spanish pattern check: ${hasSpanishPatterns}`)
    
    if (hasSpanishPatterns) {
      console.log(`[LanguageDetection] Detected Spanish from patterns`)
      return 'es'
    }
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang: 'auto', targetLang: 'en' })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`[LanguageDetection] API response:`, data)
        const detectedLang = data.sourceLang || 'en'
        console.log(`[LanguageDetection] Detected language: ${detectedLang}`)
        
        // If API says English but we have Spanish patterns, trust the patterns
        if (detectedLang === 'en' && hasSpanishPatterns) {
          console.log(`[LanguageDetection] Overriding API result with Spanish pattern detection`)
          return 'es'
        }
        
        return detectedLang
      } else {
        console.error(`[LanguageDetection] API error: ${response.status}`)
      }
    } catch (error) {
      console.error('[LanguageDetection] Error:', error)
    }
    
    // If we have Spanish patterns but API failed, return Spanish
    if (hasSpanishPatterns) {
      console.log(`[LanguageDetection] Falling back to Spanish based on patterns`)
      return 'es'
    }
    
    console.log(`[LanguageDetection] Falling back to English`)
    return 'en' // Default to English
  }, [])

  useEffect(() => {
    if (!open) {
      // reset transient error when closing
      setError(null)
      setLanguageSelected(false)
      setSelectedLanguage("")
      setSending(false)
      return
    }
    // Reset sending state when dialog opens
    if (open) {
      setSending(false)
      setError(null)
    }
    // optional initial prompt when opened
    if (open && initialPrompt && messages.length === 0 && languageSelected) {
      setMessageInput(initialPrompt)
    }
    // Removed automatic proactive analysis - let user ask first question
  }, [open, projectContext, languageSelected])

  const triggerProactiveAnalysis = useCallback(async () => {
    if (sending || messages.length > 0 || !languageSelected) return
    
    setSending(true)
    setError(null)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: "PROACTIVE_ANALYSIS", 
          userId, 
          replicaUuid, 
          projectId, 
          projectContext,
          userLanguage: selectedLanguage // Pass the selected language to chat API
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Request failed: ${res.status}`)
      }
      const json = await res.json()
      const success = Boolean(json?.success)
      let assistantText = success ? extractAssistantText(json?.data) : ""
      
      // Translate proactive analysis to selected language if not English
      if (selectedLanguage !== 'en' && assistantText) {
        assistantText = await translateText(assistantText, 'en', selectedLanguage)
      }
      
      const reply: ChatMessage = {
        id: `m-${Date.now()}-a`,
        role: "assistant",
        content: assistantText || (json?.error ? String(json.error) : "Unable to generate analysis"),
        language: selectedLanguage,
      }
      setMessages((prev) => [...prev, reply])
    } catch (e: any) {
      setError(e?.message || "Something went wrong generating analysis")
    } finally {
      setSending(false)
    }
  }, [sending, messages.length, selectedLanguage, translateText, userId, replicaUuid, projectId, projectContext])

  useEffect(() => {
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      if (endRef.current) {
        endRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
      }
    }, 100)
  }, [messages, sending])

  // Alternative scroll method for better reliability
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [])

  const sendMessage = useCallback(async () => {
    const content = messageInput.trim()
    if (!content || sending || translating || !languageSelected) return
    setSending(true)
    setTranslating(true)
    setError(null)

    // Detect language of user input
    console.log(`[SendMessage] Starting message processing for: "${content}"`)
    const detectedLang = await detectLanguage(content)
    console.log(`[SendMessage] Detected language: ${detectedLang}`)
    console.log(`[SendMessage] Selected language: ${selectedLanguage}`)
    console.log(`[SendMessage] Original message: "${content}"`)
    
    // Use detected language, but fallback to selected language if detection failed
    const finalLang = detectedLang !== 'en' ? detectedLang : (selectedLanguage !== 'en' ? selectedLanguage : 'en')
    console.log(`[SendMessage] Final language to use: ${finalLang}`)
    
    // Translate user message to English for processing if not English
    let translatedContent = content
    if (finalLang !== 'en') {
      console.log(`[SendMessage] Translating from ${finalLang} to English`)
      translatedContent = await translateText(content, finalLang, 'en')
      console.log(`[SendMessage] Translated message: "${translatedContent}"`)
    } else {
      console.log(`[SendMessage] No translation needed (already English)`)
    }

    const userMsg: ChatMessage = {
      id: `m-${Date.now()}-u`,
      role: "user",
      content: content, // Show original message to user
      originalContent: finalLang !== 'en' ? content : undefined,
      language: finalLang,
    }
    setMessages((prev) => [...prev, userMsg])
    setMessageInput("")
    // Scroll to bottom after adding user message
    setTimeout(scrollToBottom, 100)

    try {
      // Send translated content to chat API with detected language
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: translatedContent, // Send English version to chat API
          userId, 
          replicaUuid, 
          projectId, 
          projectContext,
          userLanguage: finalLang // Pass the final language to chat API
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Request failed: ${res.status}`)
      }
      const json = await res.json()
      const success = Boolean(json?.success)
      let assistantText = success ? extractAssistantText(json?.data) : ""
      console.log(`[SendMessage] Backend response success: ${success}`)
      console.log(`[SendMessage] Backend response data:`, json?.data)
      console.log(`[SendMessage] Extracted assistant text: "${assistantText}"`)
      
      // Translate assistant response back to final language if not English
      if (finalLang !== 'en' && assistantText) {
        console.log(`[SendMessage] Translating response from English to ${finalLang}`)
        
        // Check if it's a JSON response with action and content
        try {
          const parsedResponse = JSON.parse(assistantText)
          if (parsedResponse.action && parsedResponse.content) {
            // Translate only the content field
            console.log(`[SendMessage] Translating content field: "${parsedResponse.content}"`)
            const translatedContent = await translateText(parsedResponse.content, 'en', finalLang)
            console.log(`[SendMessage] Translated content: "${translatedContent}"`)
            parsedResponse.content = translatedContent
            assistantText = JSON.stringify(parsedResponse)
          } else {
            // Translate the entire text
            console.log(`[SendMessage] Translating entire text`)
            assistantText = await translateText(assistantText, 'en', finalLang)
          }
        } catch (e) {
          // If it's not JSON, translate the entire text
          console.log(`[SendMessage] Not JSON, translating entire text`)
          assistantText = await translateText(assistantText, 'en', finalLang)
        }
        console.log(`[SendMessage] Final translated response: "${assistantText}"`)
      } else {
        console.log(`[SendMessage] No translation needed for response (final language: ${finalLang})`)
      }
      
      const reply: ChatMessage = {
        id: `m-${Date.now()}-a`,
        role: "assistant",
        content: assistantText || (json?.error ? String(json.error) : "Unable to parse response"),
        language: finalLang,
      }
      setMessages((prev) => [...prev, reply])
      
      // Check if this is a get_reviews action and trigger the API call
      try {
        const parsedResponse = JSON.parse(assistantText)
        if (parsedResponse?.action === 'get_reviews' && parsedResponse?.location) {
          // Extract location from the response or use project context
          const location = parsedResponse.location !== 'extracted_location' 
            ? parsedResponse.location 
            : projectContext?.address || 'this area'
          
          // Trigger the school data API call
          setTimeout(() => {
            fetchSchoolData(location)
          }, 1000) // Small delay to show the fetching message first
        }
      } catch (e) {
        // Not a JSON response, continue normally
      }
      
      // Scroll to bottom after adding message
      setTimeout(scrollToBottom, 100)
    } catch (e: any) {
      setError(e?.message || "Something went wrong sending your message")
    } finally {
      setSending(false)
      setTranslating(false)
    }
  }, [messageInput, sending, translating, detectLanguage, translateText, userId, replicaUuid, projectId, projectContext, scrollToBottom])

  const canSend = useMemo(() => messageInput.trim().length > 0 && !sending && !translating && languageSelected, [messageInput, sending, translating, languageSelected])

  const handleLanguageChange = useCallback((value: string) => {
    setSelectedLanguage(value)
    setLanguageSelected(true)
    setSending(false) // Ensure sending state is reset when language is selected
    setError(null) // Clear any errors
  }, [])

  // Function to fetch school data using neighborhood API
  const fetchSchoolData = useCallback(async (location: string) => {
    setFetchingReviews(true)
    try {
      // First try to get coordinates from project context
      let latitude, longitude
      
      if (projectContext?.latitude && projectContext?.longitude) {
        latitude = projectContext.latitude
        longitude = projectContext.longitude
      } else if (projectContext?.address) {
        // Try to extract coordinates from address if available
        // For now, we'll use a fallback approach
        console.log('No coordinates available, using fallback location')
        // Use San Francisco coordinates as fallback
        latitude = 37.7749
        longitude = -122.4194
      } else {
        // Use San Francisco coordinates as fallback
        latitude = 37.7749
        longitude = -122.4194
      }

      const response = await fetch('/api/neighborhood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude })
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch neighborhood data')
      }
      
      const data = await response.json()
      
      // Format school data for display
      let schoolContent = ''
      if (data.schools && data.schools.length > 0) {
        schoolContent = `Based on the neighborhood data, here are the schools I found in the area:\n\n`
        schoolContent += `**Schools Nearby (${data.schools.length} found):**\n`
        data.schools.forEach((school: string, index: number) => {
          schoolContent += `${index + 1}. ${school}\n`
        })
        schoolContent += `\n**Additional Amenities:**\n`
        if (data.parks && data.parks.length > 0) {
          schoolContent += `• ${data.parks.length} parks nearby: ${data.parks.slice(0, 3).join(', ')}\n`
        }
        if (data.cafes && data.cafes.length > 0) {
          schoolContent += `• ${data.cafes.length} cafes nearby: ${data.cafes.slice(0, 3).join(', ')}\n`
        }
        if (data.transport && data.transport.length > 0) {
          schoolContent += `• ${data.transport.length} transit options: ${data.transport.slice(0, 2).join(', ')}\n`
        }
        schoolContent += `\nThis area appears to be family-friendly with good educational options and amenities.`
      } else {
        schoolContent = `I searched the area but didn't find specific school information in the immediate vicinity. However, this doesn't mean there are no schools - they might be just outside the search radius or the data might not be available. I recommend checking with local school districts or using online school finder tools for more comprehensive information.`
      }
      
      // Create a new message with the actual school data
      const schoolMessage: ChatMessage = {
        id: `m-${Date.now()}-schools`,
        role: "assistant",
        content: schoolContent,
        language: selectedLanguage,
      }
      
      setMessages((prev) => [...prev, schoolMessage])
    } catch (error) {
      console.error('Error fetching school data:', error)
      const errorMessage: ChatMessage = {
        id: `m-${Date.now()}-schools-error`,
        role: "assistant",
        content: "I encountered an issue while fetching school information. Please try again or ask about a specific aspect of the neighborhood.",
        language: selectedLanguage,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setFetchingReviews(false)
    }
  }, [selectedLanguage, projectContext])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-xl p-0 overflow-hidden", className)}>
        <div className="flex h-[70vh] min-h-[28rem] flex-col">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
              </div>
              <div className="ml-4">
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{lang.nativeName}</span>
                          <span className="text-xs text-muted-foreground">({lang.name})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {!languageSelected 
                ? "🌍 Please select your preferred language to start the conversation"
                : "💬 I can understand and respond in any language. Just type your message and I'll automatically detect the language!"
              }
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full" ref={scrollAreaRef}>
              <div className="px-4 py-4">
                {!languageSelected ? (
                  <div className="text-muted-foreground py-16 text-center text-sm">
                    <div className="mb-4">
                      <div className="text-4xl mb-2">🌍</div>
                      <div className="text-lg font-medium mb-2">Choose Your Language</div>
                      <div className="text-sm">Select your preferred language from the dropdown above to start the conversation.</div>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-muted-foreground py-16 text-center text-sm">
                    Start the conversation by asking a question.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {messages.map((m) => {
                      const isSearch = m.role === "assistant" && isSearchResponse(m.content)
                      const isYield = m.role === "assistant" && isYieldResponse(m.content)
                      const isReviews = m.role === "assistant" && isReviewsResponse(m.content)
                      const searchData = isSearch ? getSearchResponseData(m.content) : null
                      const yieldData = isYield ? getYieldResponseData(m.content) : null
                      const reviewsData = isReviews ? getReviewsResponseData(m.content) : null
                      
                      return (
                        <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}> 
                          {isSearch && searchData ? (
                            <div className="max-w-[80%] rounded-lg bg-muted p-3">
                              <p className="text-sm text-muted-foreground mb-3">
                                {searchData.location 
                                  ? `Found properties near ${searchData.location}`
                                  : "Found properties matching your search"
                                }
                              </p>
                              <Button 
                                onClick={() => window.location.href = searchData.redirectUrl}
                                className="w-full"
                              >
                                View Properties
                              </Button>
                            </div>
                          ) : isYield && yieldData ? (
                            <div className="max-w-[80%] rounded-lg bg-muted p-3">
                              <p className="text-sm text-muted-foreground mb-3">
                                {yieldData.content}
                              </p>
                              <div className="text-xs text-muted-foreground">
                                {yieldData.latitude && yieldData.longitude && (
                                  <div>📍 Location: {yieldData.latitude}, {yieldData.longitude}</div>
                                )}
                                {yieldData.propertyPrice && (
                                  <div>💰 Price: ${yieldData.propertyPrice.toLocaleString()}</div>
                                )}
                                {yieldData.hoaFees && (
                                  <div>🏠 HOA: ${yieldData.hoaFees}/month</div>
                                )}
                              </div>
                            </div>
                          ) : isReviews && reviewsData ? (
                            <div className="max-w-[80%] rounded-lg bg-muted p-3">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="text-lg">📚</div>
                                <div>
                                  <p className="text-sm font-medium">
                                    {fetchingReviews ? 'Fetching School Information...' : 'Fetching School Information'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {reviewsData.location ? `Searching in ${reviewsData.location}` : 'Searching for educational resources'}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {reviewsData.content}
                              </p>
                              {fetchingReviews && (
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                  <span className="text-xs text-muted-foreground">Gathering school data...</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                                m.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              )}
                            >
                              <div className="prose prose-sm max-w-none dark:prose-invert">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                  em: ({ children }) => <em className="italic">{children}</em>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="text-sm">{children}</li>,
                                  h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                                  code: ({ children }) => <code className="bg-muted-foreground/20 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                                  pre: ({ children }) => <pre className="bg-muted-foreground/20 p-2 rounded text-xs font-mono overflow-x-auto">{children}</pre>,
                                }}
                              >
                                {m.content}
                              </ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {sending ? (
                      <div className="flex justify-start">
                        <div className="bg-muted text-muted-foreground max-w-[80%] rounded-lg px-3 py-2 text-sm">
                          Thinking…
                        </div>
                      </div>
                    ) : fetchingReviews ? (
                      <div className="flex justify-start">
                        <div className="bg-muted text-muted-foreground max-w-[80%] rounded-lg px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            <span>Fetching school information...</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div ref={endRef} />
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="border-t p-3 sm:p-4">
            {error ? (
              <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void sendMessage()
              }}
            >
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={!languageSelected ? "Please select a language first..." : "Ask anything in any language…"}
                disabled={!languageSelected}
                rows={2}
                className="border-input placeholder:text-muted-foreground focus-visible:ring-ring/50 flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Button type="submit" disabled={!canSend} className="self-stretch">
                {translating ? "Translating…" : sending ? "Sending…" : "Send"}
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ChatbotDialog


