import { NextRequest, NextResponse } from 'next/server';
import { properties } from '@/lib/properties';

// --- Sensay API Configuration ---
const SENSAY_API_KEY = process.env.SENSAY_API_KEY || '';
const SENSAY_BASE_URL = 'https://api.sensay.io/v1';
const SENSAY_API_VERSION = '2025-03-25';
const SAMPLE_USER_ID = 'navigator-user-001'; // A consistent ID for your sample user

// --- Helpers ---
function orgHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-ORGANIZATION-SECRET': SENSAY_API_KEY,
    'X-API-Version': SENSAY_API_VERSION,
  } as Record<string, string>;
}

function userHeaders(userId: string) {
  return {
    ...orgHeaders(),
    'X-USER-ID': userId,
  } as Record<string, string>;
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
    const { message } = await req.json();
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

    // Try to parse the response as JSON, handle cases where it's not
    let criteria;
    try {
      criteria = JSON.parse(chatJson.content);
      console.log("Parsed Criteria from Sensay:", criteria);
    } catch (parseError) {
      console.log("Sensay returned non-JSON response, using fallback criteria extraction");
      // Fallback: extract criteria manually from the message
      criteria = {
        rent_max: null as number | null,
        bhk: null as number | null,
        property_type: null as "apartment" | "house" | null
      };
      
      // Simple keyword extraction as fallback
      const messageLower = message.toLowerCase();
      
      // Extract BHK
      const bhkMatch = messageLower.match(/(\d+)\s*bhk/);
      if (bhkMatch) {
        criteria.bhk = parseInt(bhkMatch[1]);
      }
      
      // Extract rent max
      const rentMatch = messageLower.match(/under\s*(\d+)|below\s*(\d+)|less\s*than\s*(\d+)/);
      if (rentMatch) {
        criteria.rent_max = parseInt(rentMatch[1] || rentMatch[2] || rentMatch[3]);
      }
      
      // Extract property type
      if (messageLower.includes('apartment')) {
        criteria.property_type = 'apartment';
      } else if (messageLower.includes('house')) {
        criteria.property_type = 'house';
      }
      
      console.log("Fallback criteria extraction:", criteria);
    }
    
    // 3. Filter local properties based on the criteria from Sensay
    let filteredProperties = properties.filter(prop => {
      if (criteria.rent_max && prop.rent > criteria.rent_max) return false;
      if (criteria.bhk && prop.bhk !== criteria.bhk) return false;
      if (criteria.property_type && prop.type !== criteria.property_type) return false;
      return true;
    });

    const responseMessage = filteredProperties.length > 0
      ? `I found ${filteredProperties.length} properties matching your criteria in Rourkela.`
      : "I couldn't find any properties that match your criteria in Rourkela. Please try a different search.";

    return NextResponse.json({
      reply: responseMessage,
      properties: filteredProperties,
      criteria,
    });

  } catch (error) {
    console.error('Error in /api/chat (Sensay):', error);
    return NextResponse.json({ error: 'Failed to process chat message via Sensay' }, { status: 500 });
  }
}

