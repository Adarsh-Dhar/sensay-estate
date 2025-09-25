import { NextRequest, NextResponse } from 'next/server'
import { CHAT_SYSTEM_PROMPT } from './prompt'

const SENSAY_BASE_URL = 'https://api.sensay.io/v1'

// Simple in-memory caches (per server instance)
const replicaCache = new Map<string, string>() // userId -> replicaUuid
const projectCache = new Map<string, { realtorDetails?: any; neighborhood?: any; ts: number }>() // projectId -> ctx

type SensayClientHeaders = {
  'Content-Type': 'application/json'
  'X-ORGANIZATION-SECRET': string
  'X-USER-ID'?: string
}

async function sensayFetch<T>(path: string, init: { method?: string; headers: SensayClientHeaders; body?: unknown; timeoutMs?: number }) {
  const url = `${SENSAY_BASE_URL}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, init.timeoutMs ?? 15000))
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
      return NextResponse.json({ error: 'Missing SENSAY_API_KEY (or NEXT_PUBLIC_SENSAY_API_KEY)' }, { status: 500 })
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

    const userId = providedUserId || 'sample-user'

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

    const completion = await sensayFetch<any>(`/replicas/${encodeURIComponent(replicaUuid)}/chat/completions`, {
      method: 'POST',
      headers,
      body: {
        content: [
          CHAT_SYSTEM_PROMPT,
          contextPrefix ? `${contextPrefix} ${message}` : message,
        ].filter(Boolean).join('\n\n'),
      },
      timeoutMs: 15000,
    })

    return NextResponse.json({ success: true, data: completion })
  } catch (error) {
    // Graceful fallback so the UI remains responsive even if upstream fails
    const errMessage = error instanceof Error ? error.message : 'Unknown error'
    // Log server-side for diagnostics
    console.error('[ChatAPI] Upstream error:', errMessage)
    const fallback = {
      action: 'reply',
      content: 'I\'m here to help with listings and neighborhoods. The AI service is temporarily unavailable, but you can ask about prices, beds, neighborhoods, or request a search like "2 bedroom apartments in Austin under 2000".',
      meta: { reason: 'upstream_error', detail: errMessage },
    }
    return NextResponse.json({ success: true, data: fallback })
  }
}


