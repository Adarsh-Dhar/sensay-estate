import { NextRequest, NextResponse } from 'next/server';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.REALTOR_RAPIDAPI_KEY || '';
const REALTOR_API_HOST = 'realtor-data1.p.rapidapi.com';

export async function GET(_req: NextRequest, context: { params: { id?: string } }) {
  if (!RAPIDAPI_KEY) {
    console.error('RapidAPI key not configured. Set RAPIDAPI_KEY or REALTOR_RAPIDAPI_KEY.');
    return NextResponse.json({ error: 'Server configuration error: Missing RAPIDAPI_KEY' }, { status: 500 });
  }

  const propertyId = context?.params?.id;
  if (!propertyId) {
    return NextResponse.json({ error: 'Missing property id' }, { status: 400 });
  }

  try {
    async function fetchDetails(pid: string) {
      const url = `https://${REALTOR_API_HOST}/properties_details/?property_id=${encodeURIComponent(pid)}`;
      console.log('[RealtorAPI:details] Requesting:', url);
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': REALTOR_API_HOST,
        },
      });
      const text = await res.text();
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      let data: any; try { data = isJson ? JSON.parse(text) : text; } catch { data = text; }
      return { res, data, contentType } as const;
    }

    // Always treat the dynamic id as the Realtor property_id
    const attempt = await fetchDetails(propertyId);

    console.log('[RealtorAPI:details] Final response:', {
      status: attempt.res.status,
      ok: attempt.res.ok,
      contentType: attempt.contentType,
      propertyId,
    });

    if (!attempt.res.ok) {
      return NextResponse.json({ error: 'Upstream Realtor API error', details: attempt.data }, { status: attempt.res.status });
    }

    return NextResponse.json(attempt.data);
  } catch (err: any) {
    console.error('Error in /api/realtor/[id]:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}


