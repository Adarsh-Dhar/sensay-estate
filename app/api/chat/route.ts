import { NextRequest, NextResponse } from 'next/server'
import { CHAT_SYSTEM_PROMPT } from './prompt'

const SENSAY_BASE_URL = 'https://api.sensay.io/v1'

type SensayClientHeaders = {
  'Content-Type': 'application/json'
  'X-ORGANIZATION-SECRET': string
  'X-USER-ID'?: string
}

async function sensayFetch<T>(path: string, init: { method?: string; headers: SensayClientHeaders; body?: unknown }) {
  const url = `${SENSAY_BASE_URL}${path}`
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: init.headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    // Ensure no caching for chat
    cache: 'no-store',
  })

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
  const headers: SensayClientHeaders = {
    'Content-Type': 'application/json',
    'X-ORGANIZATION-SECRET': apiKey,
    'X-USER-ID': userId,
  }

  const list = await sensayFetch<{ items: Array<{ uuid: string }> }>(`/replicas`, {
    method: 'GET',
    headers,
  })

  if (Array.isArray(list?.items) && list.items.length > 0) {
    return list.items[0].uuid
  }

  const created = await sensayFetch<{ uuid: string }>(`/replicas`, {
    method: 'POST',
    headers,
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
      if (hasProjectId) {
        const detailsRes = await fetch(`${origin}/api/realtor/${encodeURIComponent(projectId!)}`, { cache: 'no-store' })
        if (detailsRes.ok) {
          realtorDetails = await detailsRes.json()
          // Attempt to extract coordinates for neighborhood lookup
          const coord =
            (realtorDetails?.data?.home?.location?.address?.coordinate) ||
            (realtorDetails?.home?.location?.address?.coordinate) ||
            (realtorDetails?.location?.address?.coordinate)
          const lat = coord?.lat ?? coord?.latitude
          const lon = coord?.lon ?? coord?.lng ?? coord?.longitude
          if (typeof lat === 'number' && typeof lon === 'number') {
            const neighRes = await fetch(`${origin}/api/neighborhood`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ latitude: lat, longitude: lon }),
            })
            if (neighRes.ok) {
              neighborhood = await neighRes.json()
            }
          }
        }
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
    })

    return NextResponse.json({ success: true, data: completion })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.startsWith('404:') ? 404 : message.startsWith('401:') ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}


