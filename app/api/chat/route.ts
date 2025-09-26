import { NextRequest, NextResponse } from 'next/server'
import { CHAT_SYSTEM_PROMPT, NEGOTIATION_AGENT_PROMPT } from './prompt'

const SENSAY_BASE_URL = 'https://api.sensay.io/v1'

// Simple in-memory caches (per server instance)
const replicaCache = new Map<string, string>() // userId -> replicaUuid
const projectCache = new Map<string, { realtorDetails?: any; neighborhood?: any; ts: number }>() // projectId -> ctx

// Function to detect if the message is about property negotiation
function isNegotiationQuery(message: string, hasProjectId: boolean): boolean {
  if (!hasProjectId) return false
  
  const negotiationKeywords = [
    'negotiate', 'negotiation', 'offer', 'bargain', 'deal', 'price', 'pricing',
    'overpriced', 'underpriced', 'fair price', 'market value', 'worth', 'value',
    'should i buy', 'buying advice', 'purchase', 'bid', 'counter offer',
    'inspection', 'contingency', 'closing', 'financing', 'mortgage',
    'comparable', 'comps', 'market analysis', 'price analysis', 'valuation',
    'seller', 'motivation', 'leverage', 'strategy', 'tactics', 'advice'
  ]
  
  const lowerMessage = message.toLowerCase()
  return negotiationKeywords.some(keyword => lowerMessage.includes(keyword))
}

type SensayClientHeaders = {
  'Content-Type': 'application/json'
  'X-ORGANIZATION-SECRET': string
  'X-USER-ID'?: string
}

async function sensayFetch<T>(path: string, init: { method?: string; headers: SensayClientHeaders; body?: unknown; timeoutMs?: number }, retries = 2): Promise<T> {
  const url = `${SENSAY_BASE_URL}${path}`
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), Math.max(5000, init.timeoutMs ?? 30000))
      
      const response = await fetch(url, {
        method: init.method ?? 'GET',
        headers: init.headers,
        body: init.body ? JSON.stringify(init.body) : undefined,
        // Ensure no caching for chat
        cache: 'no-store',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        const prefix = `${response.status}:${response.statusText}`
        throw new Error(`${prefix}:{"path":"${path}","method":"${init.method ?? 'GET'}","body":${init.body ? JSON.stringify(init.body) : 'null'},"response":${JSON.stringify(text)}}`)
      }
      return (await response.json()) as T
    } catch (error) {
      const isLastAttempt = attempt === retries
      const isRetryableError = error instanceof Error && (
        error.message.includes('aborted') || 
        error.message.includes('timeout') || 
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND')
      )
      
      if (isLastAttempt || !isRetryableError) {
        throw error
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      console.log(`[ChatAPI] Retry attempt ${attempt + 1}/${retries + 1} for ${path}`)
    }
  }
  
  throw new Error('Max retries exceeded')
}

async function ensureUserExists(apiKey: string, userId: string) {
  const headers: SensayClientHeaders = {
    'Content-Type': 'application/json',
    'X-ORGANIZATION-SECRET': apiKey,
  }
  // Prefer idempotent create; treat 409 as success (already exists)
  try {
    return await sensayFetch<any>(`/users`, {
      method: 'POST',
      headers,
      body: { id: userId },
      timeoutMs: 10000,
    })
  } catch (err) {
    const message = (err as Error).message
    if (message.startsWith('409:')) {
      return { id: userId }
    }
    throw err
  }
}

async function ensureReplicaUuid(apiKey: string, userId: string): Promise<string> {
  const cached = replicaCache.get(userId)
  if (cached) return cached
  const headers: SensayClientHeaders = {
    'Content-Type': 'application/json',
    'X-ORGANIZATION-SECRET': apiKey,
    'X-USER-ID': userId,
  }

  const list = await sensayFetch<{ items: Array<{ uuid: string }> }>(`/replicas`, {
    method: 'GET',
    headers,
    timeoutMs: 10000,
  })

  if (Array.isArray(list?.items) && list.items.length > 0) {
    const uuid = list.items[0].uuid
    replicaCache.set(userId, uuid)
    return uuid
  }

  const created = await sensayFetch<{ uuid: string }>(`/replicas`, {
    method: 'POST',
    headers,
    timeoutMs: 15000,
    body: {
      name: `Sample Replica ${Date.now()}`,
      shortDescription: 'A helpful assistant for demonstration purposes',
      greeting: 'Hello! I am a sample replica. How can I help you today?',
      ownerID: userId,
      private: false,
      slug: `sample-replica-${Date.now()}`,
      llm: { provider: 'openai', model: 'gpt-4o' },
    },
  })
  replicaCache.set(userId, created.uuid)
  return created.uuid
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.SENSAY_API_KEY || process.env.NEXT_PUBLIC_SENSAY_API_KEY
    if (!apiKey) {
      console.error('[ChatAPI] Missing API key. Check your .env.local file.')
      return NextResponse.json({ 
        error: 'Missing SENSAY_API_KEY (or NEXT_PUBLIC_SENSAY_API_KEY). Please check your .env.local file.',
        details: 'Create a .env.local file with: SENSAY_API_KEY=your_api_key_here'
      }, { status: 500 })
    }

    const { message, userId: providedUserId, replicaUuid: providedReplicaUuid, projectId, projectContext } = (await req.json()) as {
      message?: string
      userId?: string
      replicaUuid?: string
      projectId?: string
      projectContext?: unknown
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 })
    }

    const userId = providedUserId || 'test_user'

    await ensureUserExists(apiKey, userId)
    const replicaUuid = providedReplicaUuid || (await ensureReplicaUuid(apiKey, userId))

    const headers: SensayClientHeaders = {
      'Content-Type': 'application/json',
      'X-ORGANIZATION-SECRET': apiKey,
      'X-USER-ID': userId,
    }

    // Build a context-enriched content message for better grounding
    let assembledContext: Record<string, any> | undefined
    try {
      const origin = new URL(req.url).origin
      const hasProjectId = typeof projectId === 'string' && projectId.trim().length > 0
      let realtorDetails: any | undefined
      let neighborhood: any | undefined

      const now = Date.now()
      const cacheTTLms = 5 * 60 * 1000 // 5 minutes
      if (hasProjectId) {
        const cached = projectCache.get(projectId!)
        if (cached && now - cached.ts < cacheTTLms) {
          realtorDetails = cached.realtorDetails
          neighborhood = cached.neighborhood
        }
      }

      // If not provided via cache or client projectContext, fetch as needed
      if (!realtorDetails && hasProjectId) {
        const detailsRes = await fetch(`${origin}/api/realtor/${encodeURIComponent(projectId!)}`, { cache: 'no-store' })
        if (detailsRes.ok) {
          realtorDetails = await detailsRes.json()
        }
      }

      const latFromContext = (projectContext as any)?.latitude
      const lonFromContext = (projectContext as any)?.longitude

      const coord =
        (realtorDetails?.data?.home?.location?.address?.coordinate) ||
        (realtorDetails?.home?.location?.address?.coordinate) ||
        (realtorDetails?.location?.address?.coordinate)
      const lat = typeof latFromContext === 'number' ? latFromContext : (coord?.lat ?? coord?.latitude)
      const lon = typeof lonFromContext === 'number' ? lonFromContext : (coord?.lon ?? coord?.lng ?? coord?.longitude)

      if (!neighborhood && typeof lat === 'number' && typeof lon === 'number') {
        const neighRes = await fetch(`${origin}/api/neighborhood`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: lat, longitude: lon }),
        })
        if (neighRes.ok) {
          neighborhood = await neighRes.json()
        }
      }

      if (hasProjectId) {
        projectCache.set(projectId!, { realtorDetails, neighborhood, ts: now })
      }

      assembledContext = {
        projectId: projectId ?? null,
        projectContext: projectContext ?? null,
        realtorDetails: realtorDetails ?? null,
        neighborhood: neighborhood ?? null,
      }
    } catch (_) {
      // Non-fatal; continue without extra context
    }

    const contextPrefix = assembledContext
      ? `Context:\n${JSON.stringify(assembledContext)}\n\nUser:`
      : (projectId || projectContext
        ? `Context:\nProject ID: ${projectId ?? 'unknown'}\nProject Data: ${JSON.stringify(projectContext ?? {})}\n\nUser:`
        : '')

    // Determine if this is a negotiation query and select appropriate prompt
    const isNegotiation = isNegotiationQuery(message, !!projectId)
    const selectedPrompt = isNegotiation ? NEGOTIATION_AGENT_PROMPT : CHAT_SYSTEM_PROMPT

    console.log(`[ChatAPI] Starting chat completion for ${isNegotiation ? 'negotiation' : 'general'} query`)
    const startTime = Date.now()
    
    const completion = await sensayFetch<any>(`/replicas/${encodeURIComponent(replicaUuid)}/chat/completions`, {
      method: 'POST',
      headers,
      body: {
        content: [
          selectedPrompt,
          contextPrefix ? `${contextPrefix} ${message}` : message,
        ].filter(Boolean).join('\n\n'),
      },
      timeoutMs: 45000, // Increased to 45 seconds for complex queries
    })

    const duration = Date.now() - startTime
    console.log(`[ChatAPI] Chat completion completed in ${duration}ms`)
    
    return NextResponse.json({ success: true, data: completion })
  } catch (error) {
    // Graceful fallback so the UI remains responsive even if upstream fails
    const errMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Enhanced logging for debugging
    console.error('[ChatAPI] Error details:', {
      message: errMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      hasApiKey: !!process.env.SENSAY_API_KEY,
      hasPublicApiKey: !!process.env.NEXT_PUBLIC_SENSAY_API_KEY,
      apiKeyLength: process.env.SENSAY_API_KEY?.length || 0,
      apiKeyPrefix: process.env.SENSAY_API_KEY?.substring(0, 8) || 'none',
    })
    
    // More specific error messages based on error type
    let userMessage = 'I\'m here to help with listings and neighborhoods. The AI service is temporarily unavailable, but you can ask about prices, beds, neighborhoods, or request a search like "2 bedroom apartments in Austin under 2000".'
    
    if (errMessage.includes('Missing SENSAY_API_KEY')) {
      userMessage = 'AI service configuration error. Please check the API key setup.'
    } else if (errMessage.includes('timeout') || errMessage.includes('ECONNREFUSED') || errMessage.includes('aborted') || errMessage.includes('AbortError')) {
      userMessage = 'AI service is taking longer than expected. Please try asking a simpler question or try again in a moment.'
    } else if (errMessage.includes('401') || errMessage.includes('403')) {
      userMessage = 'AI service authentication error. Please check the API key configuration.'
    } else if (errMessage.includes('500') || errMessage.includes('502') || errMessage.includes('503')) {
      userMessage = 'AI service is temporarily unavailable. Please try again in a few moments.'
    }
    
    const fallback = {
      action: 'reply',
      content: userMessage,
      meta: { reason: 'upstream_error', detail: errMessage },
    }
    return NextResponse.json({ success: true, data: fallback })
  }
}


