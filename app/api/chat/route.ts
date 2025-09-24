import { NextRequest, NextResponse } from 'next/server';

// --- Sensay API Configuration ---
const SENSAY_API_KEY = process.env.SENSAY_API_KEY || '';
const SENSAY_BASE_URL = 'https://api.sensay.io/v1';
const SENSAY_API_VERSION = '2025-03-25';
const SAMPLE_USER_ID = 'navigator-user-001'; // A consistent ID for your sample user

// --- RentCast Property Data API Config ---
const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY || '';
const RENTCAST_BASE_URL = 'https://api.rentcast.io/v1';

// --- Helpers ---
function orgHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-ORGANIZATION-SECRET': SENSAY_API_KEY,
    'X-API-Version': SENSAY_API_VERSION,
  } as Record<string, string>;
}

// Truncate long strings safely for logging/user messages
function safeTruncate(input: string, maxLength: number): string {
  if (!input) return '';
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength - 1) + '…';
}

function userHeaders(userId: string) {
  return {
    ...orgHeaders(),
    'X-USER-ID': userId,
  } as Record<string, string>;
}

function parseLocation(raw: string) {
  const input = (raw || '').trim();

  // ZIP (5 digits)
  const zip = input.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zip) return { postalCode: zip[1] };

  // City, ST
  const cityState = input.match(/^\s*([^,]+?)\s*,\s*([A-Za-z]{2})\s*$/);
  if (cityState) {
    return { city: cityState[1].trim(), state: cityState[2].toUpperCase() };
  }

  // Likely full street address if starts with number
  if (/^\d+\s/.test(input)) return { address: input };

  // Fallback: treat as city only (RentCast still needs state ideally)
  return { city: input };
}

// --- Helper Functions for User and Replica Management ---

/**
 * Checks if the sample user exists, and creates it if not.
 * @returns The user object.
 */
async function getOrCreateUser() {
  // Try to fetch user by ID
  try {
    const getUserRes = await fetch(`${SENSAY_BASE_URL}/users/${encodeURIComponent(SAMPLE_USER_ID)}`, {
      method: 'GET',
      headers: orgHeaders(),
    });

    if (getUserRes.ok) {
      const user = await getUserRes.json();
      console.log('Sensay user exists:', user);
      return user;
    }

    if (getUserRes.status !== 404) {
      const errBody = await getUserRes.text();
      throw new Error(`Failed to get user: ${getUserRes.status} ${getUserRes.statusText} ${errBody}`);
    }
  } catch (e) {
    // If network or other error, rethrow
    if (!(e instanceof Error)) throw e;
    // fallthrough to create
  }

  // Create user if not found
  console.log('Sensay user not found, creating new user...');
  const createUserRes = await fetch(`${SENSAY_BASE_URL}/users`, {
    method: 'POST',
    headers: orgHeaders(),
    body: JSON.stringify({ id: SAMPLE_USER_ID }),
  });
  if (!createUserRes.ok) {
    const errBody = await createUserRes.text();
    throw new Error(`Failed to create user: ${createUserRes.status} ${createUserRes.statusText} ${errBody}`);
  }
  const newUser = await createUserRes.json();
  console.log('Created new Sensay user:', newUser);
  return newUser;
}

/**
 * Retrieves the first available replica for a user, or creates a new one 
 * specifically configured for real estate queries.
 * @param userClient - An authenticated Sensay client for a specific user.
 * @param userId - The ID of the user.
 * @returns The UUID of the replica.
 */
async function getOrCreateReplica(userId: string): Promise<string> {
  // List replicas for the user
  const listRes = await fetch(`${SENSAY_BASE_URL}/replicas`, {
    method: 'GET',
    headers: userHeaders(userId),
  });
  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Failed to list replicas: ${listRes.status} ${listRes.statusText} ${err}`);
  }
  const replicas = await listRes.json();
  if (replicas.items && replicas.items.length > 0) {
    console.log('Found existing replica:', replicas.items[0].uuid);
    return replicas.items[0].uuid as string;
  }

  // If no replica exists, create one configured to extract property criteria
  console.log('No replica found, creating a new one...');

  const systemPrompt = `You are an AI assistant for a real estate platform. Your primary function is to understand a user's request and extract key filtering criteria into a pure JSON object. The JSON object must adhere to this schema: { "rent_max": number | null, "bhk": number | null, "property_type": "apartment" | "house" | null }. Do not add any conversational text, greetings, or explanations. Your response must be ONLY the JSON object. For example, if a user says "show me 3 bhk apartments under 15000", your response must be exactly: {"rent_max": 15000, "bhk": 3, "property_type": "apartment"}`;

  const createRes = await fetch(`${SENSAY_BASE_URL}/replicas`, {
    method: 'POST',
    headers: userHeaders(userId),
    body: JSON.stringify({
      name: `Real Estate Navigator Bot`,
      shortDescription: 'AI assistant to find properties.',
      greeting: 'Hello! How can I help you find a property today?',
      ownerID: userId,
      private: true,
      slug: `navigator-bot-${Date.now()}`,
      systemPrompt: systemPrompt,
      llm: {
        provider: 'openai',
        model: 'gpt-4o',
      },
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create replica: ${createRes.status} ${createRes.statusText} ${err}`);
  }
  const newReplica = await createRes.json();
  console.log('Created new replica:', newReplica.uuid);
  return newReplica.uuid as string;
}

// --- Main API Route Handler ---

export async function POST(req: NextRequest) {
  try {
    const { message, location = 'New York, NY' } = await req.json();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('Starting chat processing...');

    // 1. Ensure user and replica exist
    console.log('Creating/getting user...');
    const user = await getOrCreateUser();
    console.log('User created/got:', user.id);
    
    console.log('Creating/getting replica...');
    const replicaUuid = await getOrCreateReplica(user.id);
    console.log('Replica UUID:', replicaUuid);

    // 2. Send message to Sensay to get structured JSON criteria
    console.log('Sending message to Sensay...');
    const chatRes = await fetch(`${SENSAY_BASE_URL}/replicas/${encodeURIComponent(replicaUuid)}/chat/completions`, {
      method: 'POST',
      headers: userHeaders(user.id),
      body: JSON.stringify({ content: message }),
    });
    
    console.log('Sensay response status:', chatRes.status);
    
    if (!chatRes.ok) {
      const err = await chatRes.text();
      console.error('Sensay API error:', err);
      throw new Error(`Chat completion failed: ${chatRes.status} ${chatRes.statusText} ${err}`);
    }
    
    const chatJson = await chatRes.json();
    console.log('Sensay response:', chatJson);
    
    if (!chatJson.success || !chatJson.content) {
      throw new Error('Sensay API did not return a successful response.');
    }

    let criteria: any;
    try {
      criteria = JSON.parse(chatJson.content);
      console.log('Parsed Criteria from Sensay:', criteria);
    } catch {
      // Retry once with a strict instruction appended
      const retryRes = await fetch(`${SENSAY_BASE_URL}/replicas/${encodeURIComponent(replicaUuid)}/chat/completions`, {
        method: 'POST',
        headers: userHeaders(user.id),
        body: JSON.stringify({
          content: `${message}\n\nRespond ONLY with JSON: {"rent_max": number|null, "bhk": number|null, "property_type": "apartment"|"house"|null}`,
        }),
      });
      if (retryRes.ok) {
        const retryJson = await retryRes.json();
        try {
          criteria = JSON.parse(retryJson.content);
        } catch {
          // fall through to heuristic fallback
        }
      }

      if (!criteria) {
        // Heuristic fallback (keep your existing logic)
        criteria = { rent_max: null, bhk: null, property_type: null };
        const messageLower = message.toLowerCase();
        const bhkMatch = messageLower.match(/(\d+)\s*bhk/);
        if (bhkMatch) criteria.bhk = parseInt(bhkMatch[1]);
        const rentMatch = messageLower.match(/under\s*(\d+)|below\s*(\d+)|less\s*than\s*(\d+)/);
        if (rentMatch) criteria.rent_max = parseInt(rentMatch[1] || (rentMatch[2] as string) || (rentMatch[3] as string));
        if (messageLower.includes('apartment')) criteria.property_type = 'apartment';
        else if (messageLower.includes('house')) criteria.property_type = 'house';
      }
    }
    
    // 3. Query RentCast Property Data API
    if (!RENTCAST_API_KEY) {
      console.error('RentCast API key is not configured.');
      return NextResponse.json({
        reply: `I couldn't reach the property data service. Please configure RENTCAST_API_KEY.`,
        properties: [],
        criteria,
      });
    }

    // Build RentCast query params
    // We will prefer address search using the provided location string.
    // If your app provides structured city/state/zip, you can expand this mapping.
    const params = new URLSearchParams();
    const loc = parseLocation(location);

    if (loc.postalCode) {
      params.set('postalCode', loc.postalCode);
    } else if (loc.city && loc.state) {
      params.set('city', loc.city);
      params.set('state', loc.state);
    } else if (loc.address) {
      params.set('address', loc.address);
    } else if (loc.city) {
      // minimal fallback; better to require state, but this avoids a hard error
      params.set('city', loc.city);
    }

    if (criteria?.bhk != null) params.set('bedrooms', String(criteria.bhk));

    if (criteria?.property_type) {
      const mappedType = criteria.property_type === 'house' ? 'Single Family' : 'Condo';
      params.set('propertyType', mappedType);
    }

    params.set('limit', '20');

    const rentcastUrl = `${RENTCAST_BASE_URL}/properties?${params.toString()}`;

    const rcRes = await fetch(rentcastUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': RENTCAST_API_KEY,
      },
      // Next.js edge may reuse; ensure no caching for freshness
      cache: 'no-store' as RequestCache,
    });

    if (!rcRes.ok) {
      const errorText = await rcRes.text();
      console.warn('RentCast API responded with error.', errorText);
      return NextResponse.json({
        reply: `The property data provider returned an error: ${safeTruncate(errorText, 200)}`,
        properties: [],
        criteria,
      });
    }

    const rcJson = await rcRes.json();

    // Normalize RentCast results
    const items: any[] = Array.isArray(rcJson?.items) ? rcJson.items : (Array.isArray(rcJson) ? rcJson : []);

    const normalized = items.map((p: any) => {
      // Best effort address formatting
      const formattedAddress = p.formattedAddress
        || [p.addressLine1, p.city, p.state, p.zipCode].filter(Boolean).join(', ')
        || [p.address?.line1, p.address?.city, p.address?.state, p.address?.zip].filter(Boolean).join(', ');

      return {
        id: p.id || p.propertyId || `${p.latitude ?? ''},${p.longitude ?? ''}`,
        address: formattedAddress,
        rent: p.rent ?? p.lastListPrice ?? null, // RentCast Property Data may not include rent
        bhk: p.bedrooms ?? null,
        sqft: p.livingArea ?? p.squareFootage ?? p.buildingArea ?? null,
        type: p.propertyType ?? null,
        image: p.imageUrl ?? null, // Property data usually has no images
        coordinates: {
          lat: p.latitude ?? p.location?.lat ?? null,
          lng: p.longitude ?? p.location?.lng ?? null,
        },
      };
    });

    const responseMessage = normalized.length > 0
      ? `I found ${normalized.length} properties matching your criteria in ${location}.`
      : `I couldn't find any properties that match your criteria in ${location}.`;

    return NextResponse.json({
      reply: responseMessage,
      properties: normalized,
      criteria,
    });

  } catch (error) {
    console.error('Error in /api/chat (Sensay):', error);
    return NextResponse.json({ error: 'Failed to process chat message via Sensay' }, { status: 500 });
  }
}

