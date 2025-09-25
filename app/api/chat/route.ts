import { NextRequest, NextResponse } from 'next/server';
import { CHAT_SYSTEM_PROMPT } from './prompt';

// --- Sensay API Configuration ---
const SENSAY_API_KEY = process.env.SENSAY_API_KEY || '';
const SENSAY_BASE_URL = 'https://api.sensay.io/v1';
const SENSAY_API_VERSION = '2025-03-25';
const SAMPLE_USER_ID = 'navigator-user-001'; // A consistent ID for your sample user

// --- Realtor Property Data API Config (via RapidAPI) ---
const REALTOR_API_KEY = process.env.RAPIDAPI_KEY || '';
const REALTOR_BASE_URL = 'https://realtor-data1.p.rapidapi.com';

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
    // Delete the old replica and create a new one with the correct prompt
    const existing = replicas.items[0];
    console.log('Found existing replica, deleting and creating new one:', existing.uuid);
    
    try {
      await fetch(`${SENSAY_BASE_URL}/replicas/${encodeURIComponent(existing.uuid)}`, {
        method: 'DELETE',
        headers: userHeaders(userId),
      });
    } catch (e) {
      console.warn('Error deleting old replica:', e);
    }
  }

  // Create a new replica with the correct two-mode prompt
  console.log('Creating a new replica with two-mode prompt...');

  const systemPrompt = CHAT_SYSTEM_PROMPT;

  const createRes = await fetch(`${SENSAY_BASE_URL}/replicas`, {
    method: 'POST',
    headers: userHeaders(userId),
    body: JSON.stringify({
      name: `Real Estate Navigator Bot v2`,
      shortDescription: 'Property search with JSON responses',
      greeting: 'Hello! How can I help you find a property today?',
      ownerID: userId,
      private: true,
      slug: `navigator-bot-v2-${Date.now()}`,
      llm: {
        model: 'gpt-4o',
        systemMessage: systemPrompt,
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
    const { message, context } = await req.json();
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

    // 2. Build content for Sensay (include properties context for follow-ups)
    const propertiesContext = Array.isArray(context?.properties) ? context.properties : [];
    const baseInstruction = `${CHAT_SYSTEM_PROMPT}\n\nFollow the rules above. Respond ONLY with a single JSON object matching one of the schemas. Do not include any extra text.`;
    let sensayPayloadContent = `${baseInstruction}\n\nUser message: ${message}`;
    if (propertiesContext.length > 0) {
      sensayPayloadContent = `${baseInstruction}\n\nHere is the current list of properties the user is seeing, in JSON format:\n${JSON.stringify(propertiesContext)}\n\nNow, please answer the user's follow-up question: "${message}"`;
    }

    console.log('Sending message to Sensay...');
    const chatRes = await fetch(`${SENSAY_BASE_URL}/replicas/${encodeURIComponent(replicaUuid)}/chat/completions`, {
      method: 'POST',
      headers: userHeaders(user.id),
      body: JSON.stringify({ content: sensayPayloadContent }),
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

    // Parse AI response: expect { action: 'reply' | 'search', ... }
    let aiResponse: any;
    try {
      aiResponse = JSON.parse(chatJson.content);
    } catch {
      // Retry once with a stricter instruction
      const retryContent = `${baseInstruction}\n\nUser message: ${message}\n\nRespond ONLY with JSON. Do not include backticks or extra text.`;
      const retryRes = await fetch(`${SENSAY_BASE_URL}/replicas/${encodeURIComponent(replicaUuid)}/chat/completions`, {
        method: 'POST',
        headers: userHeaders(user.id),
        body: JSON.stringify({ content: retryContent }),
      });
      if (retryRes.ok) {
        const retryJson = await retryRes.json();
        try {
          aiResponse = JSON.parse(retryJson.content);
        } catch {}
      }
    }

    // If still not JSON, heuristically extract a search
    if (!aiResponse) {
      const lower = message.toLowerCase();
      const filters: any = { location: null, rent_max: null, rent_min: null, beds_min: null, property_type: null };
      const cityState = message.match(/\b([A-Za-z\s]+),\s*([A-Za-z]{2})\b/);
      if (cityState) filters.location = `${cityState[1].trim()}, ${cityState[2].toUpperCase()}`;
      const zip = message.match(/\b(\d{5})(?:-\d{4})?\b/);
      if (zip) filters.location = zip[1];
      const beds = lower.match(/(\d+)\s*(bed(room)?s?|bhk)/);
      if (beds) filters.beds_min = parseInt(beds[1]);
      const under = lower.match(/under\s*\$?(\d{3,6})/);
      if (under) filters.rent_max = parseInt(under[1]);
      if (lower.includes('apartment')) filters.property_type = 'apartment';
      if (lower.includes('house')) filters.property_type = 'house';
      aiResponse = { action: 'search', filters };
    }

    console.log('AI response:', aiResponse);

    // If conversational reply, return without RentCast call
    if (aiResponse?.action === 'reply' && typeof aiResponse?.content === 'string') {
      return NextResponse.json({
        reply: aiResponse.content,
        properties: propertiesContext,
      });
    }

    // If search, build Realtor API query from filters
    if (aiResponse?.action === 'search' && aiResponse?.filters && typeof aiResponse.filters === 'object') {
      if (!REALTOR_API_KEY) {
        console.error('Realtor API key is not configured.');
        return NextResponse.json({
          reply: `I couldn't reach the property data service. Please configure REALTOR_API_KEY.`,
          properties: [],
        });
      }

      const filters = aiResponse.filters as {
        location?: string | null;
        rent_max?: number | null;
        rent_min?: number | null;
        beds_min?: number | null;
        property_type?: 'apartment' | 'house' | 'condo' | null;
      };

      const parsedLoc = filters.location ? parseLocation(filters.location) : undefined;

      // Build query parameters for GET request
      const params = new URLSearchParams();
      if (parsedLoc?.city) params.set('city', parsedLoc.city);
      if (parsedLoc?.state) params.set('state', parsedLoc.state);
      if (parsedLoc?.postalCode) params.set('postalCode', parsedLoc.postalCode);
      if (parsedLoc?.address) params.set('address', parsedLoc.address);
      if (filters.beds_min) params.set('bedrooms', String(filters.beds_min));
      if (filters.property_type) {
        const mappedType = filters.property_type === 'house' ? 'Single Family' 
          : filters.property_type === 'condo' ? 'Condo' 
          : filters.property_type;
        params.set('propertyType', mappedType);
      }
      params.set('limit', '20');

      const realtorUrl = `${REALTOR_BASE_URL}/properties/list-for-sale?${params.toString()}`;
      const rcRes = await fetch(realtorUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-RapidAPI-Key': REALTOR_API_KEY,
          'X-RapidAPI-Host': 'realtor-data1.p.rapidapi.com',
        },
        cache: 'no-store' as RequestCache,
      });

      if (!rcRes.ok) {
        const errorText = await rcRes.text();
        console.warn('Realtor API responded with error.', errorText);
        return NextResponse.json({
          reply: `The property data provider returned an error: ${safeTruncate(errorText, 200)}`,
          properties: [],
        });
      }

      let rcJson = await rcRes.json();
      // Handle Realtor API response structure: data.home_search.properties
      let items: any[] = [];
      if (rcJson?.data?.home_search?.properties && Array.isArray(rcJson.data.home_search.properties)) {
        items = rcJson.data.home_search.properties;
      } else if (Array.isArray(rcJson?.items)) {
        items = rcJson.items;
      } else if (Array.isArray(rcJson)) {
        items = rcJson;
      }

      // Filter items to match requested city/state if present
      if (items.length > 0 && (parsedLoc?.city || parsedLoc?.state)) {
        const requestedCity = parsedLoc?.city?.toLowerCase();
        const requestedState = parsedLoc?.state?.toUpperCase();
        const filtered = items.filter((it: any) => {
          const itCity = (it.city || it.address?.city || '').toLowerCase();
          const itState = (it.state || it.address?.state || it.address?.stateCode || it.stateCode || '').toUpperCase();
          const cityOk = requestedCity ? itCity.includes(requestedCity) || requestedCity.includes(itCity) : true;
          const stateOk = requestedState ? itState === requestedState : true;
          return cityOk && stateOk;
        });
        if (filtered.length > 0) {
          items = filtered;
          console.log(`Filtered to ${items.length} properties in ${requestedCity}, ${requestedState}`);
        } else {
          console.log(`No properties found in ${requestedCity}, ${requestedState}, keeping all ${items.length} results`);
        }
      }

      // Fallback: if no items, try random properties by city/state if available
      if (items.length === 0 && (parsedLoc?.city && parsedLoc?.state)) {
        console.log(`No properties found, trying random properties for ${parsedLoc.city}, ${parsedLoc.state}`);
        const randomParams = new URLSearchParams({ 
          city: parsedLoc.city, 
          state: parsedLoc.state, 
          limit: '20' 
        });
        const randomUrl = `${REALTOR_BASE_URL}/properties/list-for-sale?${randomParams.toString()}`;
        const randomRes = await fetch(randomUrl, {
          method: 'GET',
          headers: { 
            'Accept': 'application/json',
            'X-RapidAPI-Key': REALTOR_API_KEY,
            'X-RapidAPI-Host': 'realtor-data1.p.rapidapi.com'
          },
          cache: 'no-store' as RequestCache,
        });
        if (randomRes.ok) {
          const randomJson = await randomRes.json();
          console.log('Random JSON:', randomJson);
          // Handle Realtor API response structure: data.home_search.properties
          let randomItems: any[] = [];
          if (randomJson?.data?.home_search?.properties && Array.isArray(randomJson.data.home_search.properties)) {
            randomItems = randomJson.data.home_search.properties;
          } else if (Array.isArray(randomJson?.items)) {
            randomItems = randomJson.items;
          } else if (Array.isArray(randomJson)) {
            randomItems = randomJson;
          }
          console.log('Random items:', randomItems);
          if (randomItems.length > 0) {
            rcJson = randomJson;
            items = randomItems;
            console.log(`Found ${randomItems.length} random properties for ${parsedLoc.city}, ${parsedLoc.state}`);
          }
        }
      }
      const properties = items.map((p: any) => {
        // console.log('Property:', p);
        const formattedAddress = p.location?.address?.line || 
          [p.location?.address?.line, p.location?.address?.city, p.location?.address?.state_code].filter(Boolean).join(', ') ||
          [p.addressLine1, p.city, p.state, p.zipCode].filter(Boolean).join(', ') ||
          [p.address?.line1, p.address?.city, p.address?.state, p.address?.zip].filter(Boolean).join(', ');

        return {
          id: p.property_id || p.id || p.propertyId || `${p.location?.address?.coordinate?.lat ?? ''},${p.location?.address?.coordinate?.lon ?? ''}`,
          address: formattedAddress,
          rent: p.list_price ?? p.rent ?? p.lastListPrice ?? null,
          bhk: p.description?.beds ?? p.bedrooms ?? null,
          sqft: p.description?.sqft ?? p.livingArea ?? p.squareFootage ?? p.buildingArea ?? null,
          type: p.description?.type ?? p.propertyType ?? null,
          image: p.primary_photo?.href ?? p.imageUrl ?? null,
          coordinates: {
            lat: p.location?.address?.coordinate?.lat ?? p.latitude ?? p.location?.lat ?? null,
            lng: p.location?.address?.coordinate?.lon ?? p.longitude ?? p.location?.lng ?? null,
          },
        };
      });

      // Send the fetched properties back to Sensay to generate the final conversational reply
      const summarizeContent = `Here are the properties found (JSON):\n${JSON.stringify(properties)}\n\nUser request: "${message}"\n\nUsing ONLY the provided JSON data above, produce a friendly, concise answer to the user. If the list is empty, suggest how to refine the search. Respond ONLY with JSON: { "action": "reply", "content": string }`;

      const summarizeRes = await fetch(`${SENSAY_BASE_URL}/replicas/${encodeURIComponent(replicaUuid)}/chat/completions`, {
        method: 'POST',
        headers: userHeaders(user.id),
        body: JSON.stringify({ content: summarizeContent }),
      });

      let replyText: string | undefined;
      if (summarizeRes.ok) {
        const summarizeJson = await summarizeRes.json();
        try {
          const parsed = JSON.parse(summarizeJson.content);
          if (parsed?.action === 'reply' && typeof parsed?.content === 'string') {
            replyText = parsed.content;
          }
        } catch {}
      }

      if (!replyText) {
        if (properties.length > 0) {
          const preview = properties.slice(0, 3).map((p) => {
            const parts = [p.address];
            if (p.bhk) parts.push(`${p.bhk} beds`);
            if (p.sqft) parts.push(`${p.sqft} sqft`);
            return `- ${parts.filter(Boolean).join(' • ')}`;
          }).join('\n');
          replyText = `I found ${properties.length} properties${filters.location ? ` in ${filters.location}` : ''}. Top matches:\n${preview}`;
        } else {
          replyText = `I couldn't find any properties${filters.location ? ` in ${filters.location}` : ''}. Try widening the area, adjusting bedrooms, or removing price limits.`;
        }
      }

      return NextResponse.json({
        reply: replyText,
        properties,
      });
    }

    // Fallback unexpected
    return NextResponse.json({
      reply: "I'm sorry, I didn't understand that. Could you try rephrasing your search?",
      properties: propertiesContext,
    });

  } catch (error) {
    console.error('Error in /api/chat (Sensay + Realtor):', error);
    return NextResponse.json({ error: 'Failed to process chat message via Sensay' }, { status: 500 });
  }
}

