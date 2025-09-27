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

// Function to generate proactive analysis
function generateProactiveAnalysis(context: any): string {
  const rd = context?.realtorDetails
  const nb = context?.neighborhood
  const pc = context?.projectContext
  
  // Extract property data
  const address = rd?.location?.address?.line || pc?.address || 'This property'
  const city = rd?.location?.address?.city || pc?.address?.split(',')[1]?.trim() || ''
  const state = rd?.location?.address?.state_code || pc?.address?.split(',')[2]?.trim() || ''
  const listPrice = rd?.list_price || pc?.price
  const beds = rd?.description?.beds || pc?.beds
  const baths = rd?.description?.baths || pc?.baths
  const sqft = rd?.building_size?.size
  const hoaFee = rd?.hoa?.fee || pc?.hoaFee
  const status = rd?.status || pc?.status
  const dom = rd?.days_on_market
  
  // Calculate key metrics
  const ppsf = listPrice && sqft ? Math.round(listPrice / sqft) : null
  const totalMonthlyCost = listPrice ? Math.round((listPrice * 0.08 / 12) + (hoaFee || 0)) : null
  
  // Generate insights
  const insights = []
  
  // Investment Score (mock calculation based on available data)
  let investmentScore = 6
  if (ppsf && ppsf < 400) investmentScore += 1
  if (dom && dom > 30) investmentScore -= 1
  if (hoaFee && hoaFee < 200) investmentScore += 1
  if (beds && beds >= 3) investmentScore += 1
  
  insights.push(`📈 **Investment Score: ${investmentScore}/10**`)
  if (ppsf) {
    insights.push(`   • Price per sqft: $${ppsf} (${ppsf < 400 ? 'competitive' : ppsf < 600 ? 'moderate' : 'premium'} for the area)`)
  }
  if (dom !== undefined) {
    insights.push(`   • Days on market: ${dom} (${dom < 30 ? 'fast-moving' : dom < 60 ? 'normal pace' : 'slow market'})`)
  }
  
  // Price Analysis
  insights.push(`\n⚖️ **Price Analysis**`)
  if (listPrice) {
    const priceFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(listPrice)
    insights.push(`   • Listed at ${priceFormatted}`)
    if (ppsf) {
      insights.push(`   • Price per sqft: $${ppsf}`)
    }
    if (totalMonthlyCost) {
      insights.push(`   • Estimated monthly cost: $${totalMonthlyCost.toLocaleString()}`)
    }
  }
  
  // Lifestyle Match
  insights.push(`\n🚶‍♂️ **Lifestyle Match**`)
  if (nb?.cafes?.length > 0) {
    insights.push(`   • ${nb.cafes.length} cafes nearby: ${nb.cafes.slice(0, 2).join(', ')}`)
  }
  if (nb?.parks?.length > 0) {
    insights.push(`   • ${nb.parks.length} parks within walking distance`)
  }
  if (nb?.schools?.length > 0) {
    insights.push(`   • ${nb.schools.length} schools nearby`)
  }
  if (nb?.transport?.length > 0) {
    insights.push(`   • Public transport: ${nb.transport.slice(0, 2).join(', ')}`)
  }
  
  // Property Features
  if (beds || baths || sqft) {
    insights.push(`\n🏠 **Property Features**`)
    if (beds) insights.push(`   • ${beds} bedroom${beds !== 1 ? 's' : ''}`)
    if (baths) insights.push(`   • ${baths} bathroom${baths !== 1 ? 's' : ''}`)
    if (sqft) insights.push(`   • ${sqft.toLocaleString()} sqft`)
    if (hoaFee) insights.push(`   • HOA: $${hoaFee}/month`)
  }
  
  // Market Position
  if (status || dom !== undefined) {
    insights.push(`\n📊 **Market Position**`)
    if (status) insights.push(`   • Status: ${status}`)
    if (dom !== undefined) {
      const marketPosition = dom < 15 ? 'Hot market - act fast!' : 
                           dom < 45 ? 'Normal market pace' : 
                           'Slow market - negotiation opportunity'
      insights.push(`   • ${marketPosition}`)
    }
  }
  
  const analysis = `Hi! I've analyzed ${address}${city ? ` in ${city}` : ''}. Here's my initial assessment:\n\n${insights.join('\n')}\n\nWhat would you like to explore in more detail?`
  
  return analysis
}

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

function isYieldQuery(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('rental yield') || 
         lower.includes('cap rate') || 
         lower.includes('roi') || 
         lower.includes('return on investment') ||
         lower.includes('investment potential') ||
         lower.includes('rental income') ||
         lower.includes('cash flow') ||
         lower.includes('rental analysis') ||
         lower.includes('investment analysis') ||
         lower.includes('what can i rent') ||
         lower.includes('how much rent') ||
         lower.includes('rental potential') ||
         lower.includes('is this a good investment') ||
         lower.includes('investment returns') ||
         lower.includes('yield analysis') ||
         lower.includes('calculate rental') ||
         lower.includes('rental calculator') ||
         lower.includes('investment calculator') ||
         lower.includes('rental yield for') ||
         lower.includes('cap rate for') ||
         lower.includes('investment potential for') ||
         lower.includes('what\'s the rental yield') ||
         lower.includes('calculate cap rate') ||
         lower.includes('rental income potential')
}

function isLocalityReviewQuery(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('what do people say') ||
         lower.includes('reviews about') ||
         lower.includes('living here') ||
         lower.includes('neighborhood reviews') ||
         lower.includes('area reviews') ||
         lower.includes('local reviews') ||
         lower.includes('community reviews') ||
         lower.includes('residents say') ||
         lower.includes('people think') ||
         lower.includes('neighborhood feedback') ||
         lower.includes('area feedback') ||
         lower.includes('local feedback') ||
         lower.includes('community feedback') ||
         lower.includes('what\'s it like living') ||
         lower.includes('how is it living') ||
         lower.includes('neighborhood experience') ||
         lower.includes('area experience') ||
         lower.includes('local experience') ||
         lower.includes('community experience') ||
         lower.includes('neighborhood opinion') ||
         lower.includes('area opinion') ||
         lower.includes('local opinion') ||
         lower.includes('community opinion') ||
         lower.includes('neighborhood sentiment') ||
         lower.includes('area sentiment') ||
         lower.includes('local sentiment') ||
         lower.includes('community sentiment') ||
         lower.includes('neighborhood reputation') ||
         lower.includes('area reputation') ||
         lower.includes('local reputation') ||
         lower.includes('community reputation')
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
      
      console.log(`[ChatAPI] Coordinate extraction: coord=`, coord, `lat=${lat}, lon=${lon}`)

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

      // Fetch yield data if this is a yield-related query
      let yieldData = null
      const isYield = isYieldQuery(message)
      console.log(`[ChatAPI] Yield query detection: "${message}" -> ${isYield}`)
      // Use default San Francisco coordinates if property coordinates are not available
      const yieldLat = typeof lat === 'number' ? lat : 37.7749
      const yieldLon = typeof lon === 'number' ? lon : -122.4194
      if (isYield) {
        try {
          const propertyPrice = (realtorDetails as any)?.list_price || 800000
          const hoaFees = (realtorDetails as any)?.hoa?.fee || 300
          console.log(`[ChatAPI] Fetching yield data for lat: ${yieldLat}, lon: ${yieldLon}, price: ${propertyPrice}, hoa: ${hoaFees}`)
          
          const yieldRes = await fetch(`${origin}/api/yield`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: yieldLat,
              longitude: yieldLon,
              propertyPrice: propertyPrice,
              hoaFees: hoaFees
            }),
          })
          if (yieldRes.ok) {
            yieldData = await yieldRes.json()
            console.log(`[ChatAPI] Yield data fetched:`, yieldData)
            
            // Return yield analysis directly instead of passing to LLM
            const capRateEvaluation = yieldData.capRate > 5 ? '✅ Good investment potential' : 
                                     yieldData.capRate > 3 ? '⚠️ Moderate investment potential' : 
                                     '❌ Low investment potential'
            
            const analysisContent = `Rental Yield Analysis:

📍 Location: ${yieldData.address}
💰 Property Price: $${yieldData.propertyPrice.toLocaleString()}
📊 Annual Costs: $${yieldData.annualCosts.toLocaleString()}

💵 Estimated Monthly Rent: $${yieldData.estimatedMonthlyRent.toLocaleString()}
📈 Annual Rental Income: $${yieldData.annualRentalIncome.toLocaleString()}
💸 Net Operating Income: $${yieldData.netOperatingIncome.toLocaleString()}
📊 Cap Rate: ${yieldData.capRate}%

${capRateEvaluation} - Cap rates above 5% are generally considered good for rental properties.`

            return NextResponse.json({ 
              success: true, 
              data: {
                action: 'reply',
                content: analysisContent
              }
            })
          } else {
            console.error('[ChatAPI] Yield API error:', yieldRes.status, yieldRes.statusText)
          }
        } catch (error) {
          console.error('[ChatAPI] Error fetching yield data:', error)
        }
      }

      // Fetch locality reviews if this is a review-related query
      let reviewData = null
      const isReview = isLocalityReviewQuery(message)
      console.log(`[ChatAPI] Review query detection: "${message}" -> ${isReview}`)
      
      if (isReview) {
        try {
          // Extract locality name from property data or use coordinates
          let localityQuery = ''
          if (realtorDetails) {
            const address = realtorDetails?.location?.address?.line || realtorDetails?.data?.home?.location?.address?.line
            const city = realtorDetails?.location?.address?.city || realtorDetails?.data?.home?.location?.address?.city
            const state = realtorDetails?.location?.address?.state_code || realtorDetails?.data?.home?.location?.address?.state_code
            localityQuery = [address, city, state].filter(Boolean).join(', ')
          } else if (typeof lat === 'number' && typeof lon === 'number') {
            // Use coordinates to get locality name via reverse geocoding
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${process.env.GOOGLE_MAPS_API_KEY}`
            const geocodeRes = await fetch(geocodeUrl)
            if (geocodeRes.ok) {
              const geocodeData = await geocodeRes.json()
              if (geocodeData.results && geocodeData.results.length > 0) {
                const result = geocodeData.results[0]
                localityQuery = result.formatted_address || result.address_components?.find((c: any) => c.types.includes('locality'))?.long_name || 'this area'
              }
            }
          }
          
          if (localityQuery) {
            console.log(`[ChatAPI] Fetching reviews for locality: ${localityQuery}`)
            
            const reviewRes = await fetch(`${origin}/api/reviews`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                query: localityQuery,
                latitude: lat,
                longitude: lon,
                radius: 3
              }),
            })
            
            if (reviewRes.ok) {
              reviewData = await reviewRes.json()
              console.log(`[ChatAPI] Review data fetched:`, reviewData)
              
              // Return review analysis directly instead of passing to LLM
              const reviewContent = `🏘️ **Neighborhood Reviews for ${reviewData.source || localityQuery}**

${reviewData.summary || 'No reviews available for this area.'}

${reviewData.reviewCount ? `📊 Based on ${reviewData.reviewCount} reviews from ${reviewData.placesReviewed || 1} local establishments` : ''}
${reviewData.averageRating ? `⭐ Average rating: ${reviewData.averageRating}/5` : ''}

💡 **Local Insights:**
${neighborhood ? `
• **Cafes nearby:** ${neighborhood.cafes?.length ? neighborhood.cafes.slice(0, 3).join(', ') : 'None found'}
• **Parks nearby:** ${neighborhood.parks?.length ? neighborhood.parks.slice(0, 3).join(', ') : 'None found'}
• **Schools nearby:** ${neighborhood.schools?.length ? neighborhood.schools.slice(0, 3).join(', ') : 'None found'}
• **Public transport:** ${neighborhood.transport?.length ? neighborhood.transport.slice(0, 2).join(', ') : 'None found'}
` : 'Additional neighborhood data not available'}

📍 **Search Radius:** 3 miles from property location`

              return NextResponse.json({ 
                success: true, 
                data: {
                  action: 'reply',
                  content: reviewContent
                }
              })
            } else {
              console.error('[ChatAPI] Review API error:', reviewRes.status, reviewRes.statusText)
            }
          } else {
            console.log('[ChatAPI] No locality information available for review query')
          }
        } catch (error) {
          console.error('[ChatAPI] Error fetching review data:', error)
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
        yieldData: yieldData ?? null,
        reviewData: reviewData ?? null,
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
          yieldData: assembledContext.yieldData ?? null,
          reviewData: assembledContext.reviewData ?? null,
        }
      : null

    // Build a very small, plain-text context block instead of embedding raw JSON
    let minimalContextText = ''
    if (compactedContext) {
      const rd = compactedContext.realtorDetails as any
      const nb = compactedContext.neighborhood as any
      const yd = compactedContext.yieldData as any
      const rv = compactedContext.reviewData as any
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
        // Add yield data first if available (highest priority)
        yd && `RENTAL_YIELD_DATA: cap_rate: ${yd.capRate}%, monthly_rent: $${yd.estimatedMonthlyRent}, annual_income: $${yd.annualRentalIncome}, net_income: $${yd.netOperatingIncome}, annual_costs: $${yd.annualCosts}`,
        // Add review data if available
        rv && `NEIGHBORHOOD_REVIEWS: ${rv.summary} (${rv.reviewCount} reviews)`,
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
      console.log(`[ChatAPI] Context text: ${minimalContextText}`)
    } else if (projectId || projectContext) {
      minimalContextText = `project: ${projectId ?? 'unknown'}`
    }

    // Determine if this is a proactive analysis request
    const isProactiveAnalysis = message === "PROACTIVE_ANALYSIS" && !!projectId
    const isNegotiation = isNegotiationQuery(message, !!projectId)
    const isYield = isYieldQuery(message)
    const isReview = isLocalityReviewQuery(message)
    wasNegotiation = isNegotiation
    
    // Use a compact negotiation prompt to reduce token pressure
    const selectedPrompt = isNegotiation ? NEGOTIATION_AGENT_PROMPT_COMPACT : CHAT_SYSTEM_PROMPT

    console.log(`[ChatAPI] Starting chat completion for ${isProactiveAnalysis ? 'proactive analysis' : isNegotiation ? 'negotiation' : isYield ? 'yield' : isReview ? 'review' : 'general'} query`)
    const startTime = Date.now()
    
    // Handle proactive analysis with special prompt
    if (isProactiveAnalysis) {
      const proactiveAnalysis = generateProactiveAnalysis(compactedContext)
      return NextResponse.json({ 
        success: true, 
        data: { 
          action: 'reply', 
          content: proactiveAnalysis 
        } 
      })
    }
    
    // Handle review queries - if we have review data, return it directly
    if (isReview && assembledContext?.reviewData) {
      const rd = assembledContext.reviewData as any
      console.log(`[ChatAPI] Including review data in response:`, rd)
      
      const reviewContent = `🏘️ **Neighborhood Reviews for ${rd.source || 'this area'}**

${rd.summary || 'No reviews available for this area.'}

${rd.reviewCount ? `📊 Based on ${rd.reviewCount} reviews from ${rd.placesReviewed || 1} local establishments` : ''}
${rd.averageRating ? `⭐ Average rating: ${rd.averageRating}/5` : ''}

💡 **Local Insights:**
${assembledContext?.neighborhood ? `
• **Cafes nearby:** ${assembledContext.neighborhood.cafes?.length ? assembledContext.neighborhood.cafes.slice(0, 3).join(', ') : 'None found'}
• **Parks nearby:** ${assembledContext.neighborhood.parks?.length ? assembledContext.neighborhood.parks.slice(0, 3).join(', ') : 'None found'}
• **Schools nearby:** ${assembledContext.neighborhood.schools?.length ? assembledContext.neighborhood.schools.slice(0, 3).join(', ') : 'None found'}
• **Public transport:** ${assembledContext.neighborhood.transport?.length ? assembledContext.neighborhood.transport.slice(0, 2).join(', ') : 'None found'}
` : 'Additional neighborhood data not available'}

📍 **Search Radius:** 3 miles from property location`

      return NextResponse.json({ 
        success: true, 
        data: {
          action: 'reply',
          content: reviewContent
        }
      })
    }
    
    // If this is a yield query and we have yield data, include it directly in the prompt
    let yieldDataText = ''
    if (isYield && assembledContext?.yieldData) {
      const yd = assembledContext.yieldData as any
      console.log(`[ChatAPI] Including yield data in prompt:`, yd)
      yieldDataText = `\n\nCRITICAL: The user is asking about rental yield. Here is the actual yield data for this property:
RENTAL_YIELD_DATA: cap_rate: ${yd.capRate}%, monthly_rent: $${yd.estimatedMonthlyRent}, annual_income: $${yd.annualRentalIncome}, net_income: $${yd.netOperatingIncome}, annual_costs: $${yd.annualCosts}

You MUST use this data to provide a detailed analysis instead of returning a calculate_yield action. Return {"action": "reply", "content": "Your detailed analysis here"}`
    }

    // If this is a review query and we have review data, include it in the prompt
    let reviewDataText = ''
    if (isReview && assembledContext?.reviewData) {
      const rd = assembledContext.reviewData as any
      console.log(`[ChatAPI] Including review data in prompt:`, rd)
      reviewDataText = `\n\nCRITICAL: The user is asking about neighborhood reviews. Here is the actual review data for this area:
NEIGHBORHOOD_REVIEWS: ${rd.summary} (${rd.reviewCount} reviews from ${rd.placesReviewed} places, avg rating: ${rd.averageRating}/5)

You MUST use this data to provide a detailed analysis instead of returning a get_reviews action. Return {"action": "reply", "content": "Your detailed analysis here"}`
    }

    const rawContent = [
      selectedPrompt,
      minimalContextText ? `Context: ${minimalContextText}` : undefined,
      yieldDataText,
      reviewDataText,
      `User: ${message}`,
    ].filter(Boolean).join('\n\n')

    // Cap to avoid upstream 500 due to oversize payload
    // Safe maximum request size for upstream stability
    const MAX_CONTENT = 12000
    const finalContent = rawContent.length > MAX_CONTENT ? rawContent.slice(0, MAX_CONTENT) : rawContent

    console.log(`[ChatAPI] Payload sizes: context=${minimalContextText.length}, raw=${rawContent.length}, final=${finalContent.length}`)
    console.log(`[ChatAPI] Yield data text: ${yieldDataText}`)
    console.log(`[ChatAPI] Final content preview: ${finalContent.slice(0, 500)}...`)
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


