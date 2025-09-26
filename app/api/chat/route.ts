import { NextRequest, NextResponse } from 'next/server'
import { CHAT_SYSTEM_PROMPT, NEGOTIATION_AGENT_PROMPT, NEGOTIATION_AGENT_PROMPT_COMPACT } from './prompt'

const SENSAY_BASE_URL = 'https://api.sensay.io/v1'

// Utilities to compact context and cap payload sizes
function truncateString(s: string, max = 20000) {
  if (typeof s !== 'string') return s as any
  return s.length > max ? s.slice(0, max) : s
}

function safeJSONStringify(obj: any, max = 20000) {
  try {
    const s = JSON.stringify(obj)
    return truncateString(s, max)
  } catch {
    return ''
  }
}

function compactRealtorDetails(rd: any) {
  if (!rd) return null
  const home = rd?.data?.home || rd?.home || rd
  const loc = home?.location?.address || home?.address || {}
  const desc = home?.description || {}
  const bs = home?.building_size || {}
  const hoa = home?.hoa || {}
  const price_history = Array.isArray(home?.price_history) ? home.price_history.slice(0, 5) : undefined
  // Drop photos entirely to minimize payload and avoid provider validation on URLs
  const photos = undefined

  return {
    list_price: home?.list_price,
    status: home?.status,
    days_on_market: home?.days_on_market,
    description: { beds: desc?.beds, baths: desc?.baths, type: desc?.type },
    building_size: { size: bs?.size },
    year_built: home?.year_built,
    hoa: { fee: hoa?.fee },
    location: {
      address: {
        line: loc?.line,
        city: loc?.city,
        state_code: loc?.state_code,
        postal_code: loc?.postal_code,
        coordinate: home?.location?.address?.coordinate || undefined,
      },
    },
    price_history,
    photos,
  }
}

function compactNeighborhood(nb: any) {
  if (!nb) return null
  return {
    area: nb?.area || nb?.name,
    walkability_score: nb?.walkability_score,
    crime_rate: nb?.crime_rate,
    market_trends: Array.isArray(nb?.market_trends) ? nb.market_trends.slice(0, 3) : undefined,
    schools: Array.isArray(nb?.schools) ? nb.schools.slice(0, 3) : undefined,
  }
}

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
        const errorMessage = `${prefix}:{"path":"${path}","method":"${init.method ?? 'GET'}","body":${init.body ? JSON.stringify(init.body) : 'null'},"response":${JSON.stringify(text)}}`
        // Retry on provider 5xx errors
        if ([500, 502, 503, 504].includes(response.status)) {
          throw new Error(errorMessage)
        }
        throw new Error(errorMessage)
      }
      return (await response.json()) as T
    } catch (error) {
      const isLastAttempt = attempt === retries
      const isRetryableError = error instanceof Error && (
        error.message.includes('aborted') || 
        error.message.includes('timeout') || 
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('500:') ||
        error.message.includes('502:') ||
        error.message.includes('503:') ||
        error.message.includes('504:')
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

async function createFallbackReplica(apiKey: string, userId: string): Promise<string> {
  const headers: SensayClientHeaders = {
    'Content-Type': 'application/json',
    'X-ORGANIZATION-SECRET': apiKey,
    'X-USER-ID': userId,
  }
  // Try a smaller OpenAI model first, then Anthropic
  const candidates = [
    { provider: 'openai', model: 'gpt-4o-mini' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet' },
  ]
  for (const llm of candidates) {
    try {
      const created = await sensayFetch<{ uuid: string }>(`/replicas`, {
        method: 'POST',
        headers,
        timeoutMs: 15000,
        body: {
          name: `Fallback Replica ${Date.now()}`,
          shortDescription: 'Fallback assistant for reliability',
          greeting: 'Hi! I can help with real estate and negotiation.',
          ownerID: userId,
          private: true,
          slug: `fallback-replica-${Date.now()}`,
          llm,
        },
      })
      return created.uuid
    } catch (_) {
      // try next candidate
    }
  }
  throw new Error('Failed to create fallback replica')
}

export async function POST(req: NextRequest) {
  type NegotiationContext = {
    address?: string
    city?: string
    state?: string
    postal?: string
    listPrice?: number
    beds?: number
    baths?: number
    sqft?: number
    status?: string
    dom?: number
    hoaFee?: number
  }

  let lastKnownContext: NegotiationContext = {}
  let wasNegotiation = false
  let incomingMessage: string | undefined
  let hadProjectId = false

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
    incomingMessage = message

    await ensureUserExists(apiKey, userId)
    const replicaUuid = providedReplicaUuid || (await ensureReplicaUuid(apiKey, userId))

    const headers: SensayClientHeaders & { Accept?: string } = {
      'Content-Type': 'application/json',
      'X-ORGANIZATION-SECRET': apiKey,
      'X-USER-ID': userId,
      // Some providers require explicit Accept header
      Accept: 'application/json',
    }

    // Build a context-enriched content message for better grounding
    let assembledContext: Record<string, any> | undefined
    try {
      const origin = new URL(req.url).origin
      const hasProjectId = typeof projectId === 'string' && projectId.trim().length > 0
      hadProjectId = hasProjectId
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

    // Compact and cap context size before sending upstream
    const compactedContext = assembledContext
      ? {
          projectId: assembledContext.projectId ?? null,
          projectContext: assembledContext.projectContext ?? null,
          realtorDetails: compactRealtorDetails(assembledContext.realtorDetails),
          neighborhood: compactNeighborhood(assembledContext.neighborhood),
        }
      : null

    // Build a very small, plain-text context block instead of embedding raw JSON
    let minimalContextText = ''
    if (compactedContext) {
      const rd = compactedContext.realtorDetails as any
      const nb = compactedContext.neighborhood as any
      const addressLine = rd?.location?.address?.line
      const city = rd?.location?.address?.city
      const state = rd?.location?.address?.state_code
      const postal = rd?.location?.address?.postal_code
      const listPrice = rd?.list_price
      const beds = rd?.description?.beds
      const baths = rd?.description?.baths
      const status = rd?.status
      const dom = rd?.days_on_market
      const hoaFee = rd?.hoa?.fee
      const sqft = rd?.building_size?.size
      lastKnownContext = {
        address: addressLine,
        city,
        state,
        postal,
        listPrice: typeof listPrice === 'number' ? listPrice : undefined,
        beds: typeof beds === 'number' ? beds : undefined,
        baths: typeof baths === 'number' ? baths : undefined,
        sqft: typeof sqft === 'number' ? sqft : undefined,
        status,
        dom: typeof dom === 'number' ? dom : undefined,
        hoaFee: typeof hoaFee === 'number' ? hoaFee : undefined,
      }
      const parts = [
        addressLine && `${addressLine}${city ? ', ' + city : ''}${state ? ', ' + state : ''}${postal ? ' ' + postal : ''}`,
        typeof listPrice === 'number' && `list_price: $${listPrice}`,
        (beds || beds === 0) && (baths || baths === 0) && `beds/baths: ${beds}/${baths}`,
        sqft && `sqft: ${sqft}`,
        status && `status: ${status}`,
        (dom || dom === 0) && `days_on_market: ${dom}`,
        (hoaFee || hoaFee === 0) && `hoa_fee: ${hoaFee}`,
        nb?.walkability_score && `walk: ${nb.walkability_score}`,
      ].filter(Boolean)
      minimalContextText = parts.join(' | ')
    } else if (projectId || projectContext) {
      minimalContextText = `project: ${projectId ?? 'unknown'}`
    }

    // Determine if this is a negotiation query and select appropriate prompt
    const isNegotiation = isNegotiationQuery(message, !!projectId)
    wasNegotiation = isNegotiation
    // Use a compact negotiation prompt to reduce token pressure
    const selectedPrompt = isNegotiation ? NEGOTIATION_AGENT_PROMPT_COMPACT : CHAT_SYSTEM_PROMPT

    console.log(`[ChatAPI] Starting chat completion for ${isNegotiation ? 'negotiation' : 'general'} query`)
    const startTime = Date.now()
    
    const rawContent = [
      selectedPrompt,
      minimalContextText ? `Context: ${minimalContextText}` : undefined,
      `User: ${message}`,
    ].filter(Boolean).join('\n\n')

    // Cap to avoid upstream 500 due to oversize payload
    // Safe maximum request size for upstream stability
    const MAX_CONTENT = 12000
    const finalContent = rawContent.length > MAX_CONTENT ? rawContent.slice(0, MAX_CONTENT) : rawContent

    console.log(`[ChatAPI] Payload sizes: context=${minimalContextText.length}, raw=${rawContent.length}, final=${finalContent.length}`)
    // Use a single, provider-supported body shape and fallback to a fresh replica on provider errors
    const targetPathBase = `/replicas/${encodeURIComponent(replicaUuid)}/chat/completions`

    async function requestWithContent(path: string) {
      return await sensayFetch<any>(path, {
        method: 'POST',
        headers,
        body: { content: finalContent },
        timeoutMs: 45000,
      }, 3)
    }

    let completion: any
    try {
      completion = await requestWithContent(targetPathBase)
    } catch (primaryErr) {
      const msg = (primaryErr as Error)?.message || ''
      const isProviderIssue = msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('Provider returned error')
      if (!isProviderIssue) {
        throw primaryErr
      }
      console.warn('[ChatAPI] Provider error on primary replica, creating fallback replica...')
      const fallbackReplicaUuid = await createFallbackReplica(apiKey, userId)
      const fallbackPath = `/replicas/${encodeURIComponent(fallbackReplicaUuid)}/chat/completions`
      completion = await requestWithContent(fallbackPath)
    }

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
    } else if (errMessage.includes('500') || errMessage.includes('502') || errMessage.includes('503') || errMessage.includes('Failed to create fallback replica') || errMessage.includes('Provider returned error') || errMessage.includes('400:')) {
      // Provide a concise, on-brand negotiation draft if the user was asking for negotiation
      if (wasNegotiation) {
        const ppsf = lastKnownContext.listPrice && lastKnownContext.sqft ? Math.round((lastKnownContext.listPrice / lastKnownContext.sqft)) : undefined
        const addr = [lastKnownContext.address, lastKnownContext.city, lastKnownContext.state, lastKnownContext.postal].filter(Boolean).join(', ')
        const anchor = lastKnownContext.listPrice ? Math.round(lastKnownContext.listPrice * 0.88) : undefined
        const reasonParts: string[] = []
        if (ppsf) reasonParts.push(`PPSF ~$${ppsf}`)
        if (typeof lastKnownContext.dom === 'number') reasonParts.push(`${lastKnownContext.dom} DOM`)
        if (lastKnownContext.hoaFee || lastKnownContext.hoaFee === 0) reasonParts.push(`HOA $${lastKnownContext.hoaFee}/mo`)
        const reasons = reasonParts.slice(0, 3).join(', ')
        const shortAddr = addr || 'this property'
        const draft = anchor
          ? `Hey—thanks for the details on ${shortAddr}. Given condition and market tempo, I'm at $${anchor} to start. Rationale: ${reasons || 'market positioning and comps'}. Happy to move on terms (faster close, clean contingencies) for value alignment. What's seller flexibility like?`
          : `Hey—on ${shortAddr}, I’d start with a below-ask anchor tied to faster close and clean contingencies. Rationale: ${reasons || 'market positioning and comps'}. What’s seller flexibility like?`
        userMessage = draft
      } else {
        userMessage = 'AI service is temporarily unavailable. Retrying shortly usually helps—please try again.'
      }
    }
    
    const fallback = {
      action: 'reply',
      content: userMessage,
      meta: { reason: 'upstream_error', detail: errMessage },
    }
    return NextResponse.json({ success: true, data: fallback })
  }
}


