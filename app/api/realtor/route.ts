import { NextRequest, NextResponse } from 'next/server';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.REALTOR_RAPIDAPI_KEY || '';
const REALTOR_API_HOST = 'realtor-data1.p.rapidapi.com';
const REALTOR_API_URL = `https://${REALTOR_API_HOST}/property_list/`;
const REALTOR_DETAILS_URL = (pid: string) => `https://${REALTOR_API_HOST}/properties_details/?property_id=${encodeURIComponent(pid)}`;

export async function POST(req: NextRequest) {
  if (!RAPIDAPI_KEY) {
    console.error('RapidAPI key not configured. Set RAPIDAPI_KEY or REALTOR_RAPIDAPI_KEY.');
    return NextResponse.json({ error: 'Server configuration error: Missing RAPIDAPI_KEY' }, { status: 500 });
  }

  try {
    const body = await req.json();
    console.log('[RealtorAPI] Incoming body:', safeStringify(body));

    // Allow callers to either provide a ready-made `query` object, or provide flat filter fields
    const {
      // pagination
      limit,
      offset,
      // sort inputs (either as object or as separate direction/field)
      sort,
      direction,
      field,
      // flat filters that we will fold into query if query is not provided
      state_code,
      city,
      street_name,
      address,
      postal_code,
      agent_source_id,
      selling_agent_name,
      source_listing_id,
      property_id,
      fulfillment_id,
      search_location,
      radius,
      location,
      status,
      type,
      keywords,
      boundary,
      baths,
      beds,
      open_house,
      year_built,
      sold_price,
      sold_date,
      list_price,
      lot_sqft,
      sqft,
      hoa_fee,
      no_hoa_fee,
      pending,
      contingent,
      foreclosure,
      has_tour,
      new_construction,
      cats,
      dogs,
      matterport,
      // if a full query object is passed, we will prefer that
      query: incomingQuery,
      ...rest
    } = body || {};

    // Build the query object from available parts if not provided directly
    let query: Record<string, any> = incomingQuery && typeof incomingQuery === 'object' ? { ...incomingQuery } : {};

    if (!incomingQuery) {
      // Fold recognized filter fields into query
      const derivedSearchLocation = search_location || ((radius || location) ? { radius, location } : undefined);

      query = {
        ...query,
        ...(state_code !== undefined ? { state_code } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(street_name !== undefined ? { street_name } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(postal_code !== undefined ? { postal_code } : {}),
        ...(agent_source_id !== undefined ? { agent_source_id } : {}),
        ...(selling_agent_name !== undefined ? { selling_agent_name } : {}),
        ...(source_listing_id !== undefined ? { source_listing_id } : {}),
        ...(property_id !== undefined ? { property_id } : {}),
        ...(fulfillment_id !== undefined ? { fulfillment_id } : {}),
        ...(derivedSearchLocation ? { search_location: derivedSearchLocation } : {}),
        ...(status !== undefined ? { status } : {}), // expects array of string
        ...(type !== undefined ? { type } : {}), // expects array of string
        ...(keywords !== undefined ? { keywords } : {}), // string or array per upstream
        ...(boundary !== undefined ? { boundary } : {}),
        ...(baths !== undefined ? { baths } : {}),
        ...(beds !== undefined ? { beds } : {}),
        ...(open_house !== undefined ? { open_house } : {}),
        ...(year_built !== undefined ? { year_built } : {}),
        ...(sold_price !== undefined ? { sold_price } : {}),
        ...(sold_date !== undefined ? { sold_date } : {}),
        ...(list_price !== undefined ? { list_price } : {}),
        ...(lot_sqft !== undefined ? { lot_sqft } : {}),
        ...(sqft !== undefined ? { sqft } : {}),
        ...(hoa_fee !== undefined ? { hoa_fee } : {}),
        ...(no_hoa_fee !== undefined ? { no_hoa_fee } : {}),
        ...(pending !== undefined ? { pending } : {}),
        ...(contingent !== undefined ? { contingent } : {}),
        ...(foreclosure !== undefined ? { foreclosure } : {}),
        ...(has_tour !== undefined ? { has_tour } : {}),
        ...(new_construction !== undefined ? { new_construction } : {}),
        ...(cats !== undefined ? { cats } : {}),
        ...(dogs !== undefined ? { dogs } : {}),
        ...(matterport !== undefined ? { matterport } : {}),
        // Include any other unknown keys into query as a fallback
        ...rest,
      };
    }

    const effectiveSort = sort || ((direction || field) ? { direction, field } : undefined);

    // Apply sensible defaults if caller didn't specify a location or limit
    const queryHasLocation = !!(
      (query && (query.city || query.state_code || query.address || query.postal_code)) ||
      (query && query.search_location && (query.search_location.location || query.search_location.lat))
    );

    const defaultQuery = queryHasLocation
      ? {}
      : {
          query: {
            status: Array.isArray(status) ? status : ["for_sale"],
            search_location: { location: "San Francisco, CA", radius: 10 },
          },
        };

    const payload: Record<string, any> = {
      ...(Object.keys(query).length > 0 ? { query } : {}),
      ...defaultQuery,
      ...(limit !== undefined ? { limit } : { limit: 100 }),
      ...(offset !== undefined ? { offset } : {}),
      ...(effectiveSort ? { sort: effectiveSort } : {}),
    };

    console.log('[RealtorAPI] Outbound payload:', safeStringify(payload));

    const response = await fetch(REALTOR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': REALTOR_API_HOST,
      },
      body: JSON.stringify(payload),
      // Realtor API expects POST body
    });

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    console.log('[RealtorAPI] Upstream response:', {
      status: response.status,
      ok: response.ok,
      contentType,
      url: REALTOR_API_URL,
    });
    let data: any;
    try {
      data = isJson ? JSON.parse(text) : text;
    } catch {
      data = text;
    }

    console.log('[RealtorAPI] Parsed data summary:', summarizeData(data));

    if (!response.ok) {
      console.error('Realtor API error (first attempt)', { status: response.status, data });

      // Retry once with a minimal, safe payload to improve resilience
      const originalQuery = (payload as any)?.query || {};
      const minimalQuery = {
        status: Array.isArray(originalQuery?.status)
          ? originalQuery.status
          : ["for_sale"],
        search_location:
          originalQuery?.search_location?.location
            ? { location: originalQuery.search_location.location }
            : { location: "San Francisco, CA" },
        // Include bedroom and bathroom filters in retry
        ...(originalQuery?.beds ? { beds: originalQuery.beds } : {}),
        ...(originalQuery?.baths ? { baths: originalQuery.baths } : {}),
        ...(originalQuery?.list_price ? { list_price: originalQuery.list_price } : {}),
      };

      const minimalPayload = {
        query: minimalQuery,
        limit: typeof (payload as any)?.limit === 'number' ? (payload as any).limit : 12,
      };

      console.log('[RealtorAPI] Retry payload:', safeStringify(minimalPayload));

      const retryRes = await fetch(REALTOR_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': REALTOR_API_HOST,
        },
        body: JSON.stringify(minimalPayload),
      });

      console.log('[RealtorAPI] Retry response:', {
        status: retryRes.status,
        ok: retryRes.ok,
        contentType: retryRes.headers.get('content-type'),
      });

      const retryText = await retryRes.text();
      const retryCT = retryRes.headers.get('content-type') || '';
      const retryIsJson = retryCT.includes('application/json');
      let retryData: any;
      try { retryData = retryIsJson ? JSON.parse(retryText) : retryText; } catch { retryData = retryText; }

      if (!retryRes.ok) {
        console.error('Realtor API error (retry)', { status: retryRes.status, data: retryData });
        
        // Try one more time with just basic filters (no beds/baths)
        const basicQuery = {
          status: ["for_sale"],
          search_location: { location: "San Francisco, CA" },
          ...(originalQuery?.list_price ? { list_price: originalQuery.list_price } : {}),
        };

        const basicPayload = {
          query: basicQuery,
          limit: 100,
        };

        console.log('[RealtorAPI] Basic fallback payload:', safeStringify(basicPayload));

        const basicRes = await fetch(REALTOR_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': REALTOR_API_HOST,
          },
          body: JSON.stringify(basicPayload),
        });

        if (!basicRes.ok) {
          console.error('Realtor API error (basic fallback)', { status: basicRes.status });
          return NextResponse.json({ error: 'Upstream Realtor API error', details: retryData }, { status: retryRes.status });
        }

        const basicText = await basicRes.text();
        const basicCT = basicRes.headers.get('content-type') || '';
        const basicIsJson = basicCT.includes('application/json');
        let basicData: any;
        try { basicData = basicIsJson ? JSON.parse(basicText) : basicText; } catch { basicData = basicText; }

        data = basicData;
      } else {
        data = retryData;
      }
    }

    // Normalize to a predictable array for the client
    const normalizedRaw: any[] =
      (data && Array.isArray(data) && data) ||
      (data?.results && Array.isArray(data.results) && data.results) ||
      (data?.properties && Array.isArray(data.properties) && data.properties) ||
      (data?.listings && Array.isArray(data.listings) && data.listings) ||
      (data?.data?.results && Array.isArray(data.data.results) && data.data.results) ||
      (data?.data?.home_search?.results && Array.isArray(data.data.home_search.results) && data.data.home_search.results) ||
      (data?.data?.home_search?.properties && Array.isArray(data.data.home_search.properties) && data.data.home_search.properties) ||
      [];

    // Adapt common GraphQL response fields into our UI-friendly shape
    const normalized = normalizedRaw.map((p: any) => {
      const desc = p?.description || {};
      const location = p?.location || {};
      const addr = location?.address || p?.address || {};
      const photos = Array.isArray(p?.photos) ? p.photos : [];
      const primaryPhoto = p?.primary_photo?.href || photos?.[0]?.href || p?.photo;

      // Parse baths which may arrive as "2" or "2.5" string
      const bathsStr = p?.baths ?? p?.bathrooms ?? desc?.baths_consolidated;
      const bathsNum = typeof bathsStr === 'string' ? parseFloat(bathsStr) : bathsStr;

      const sqft = p?.sqft ?? p?.living_area ?? desc?.sqft ?? p?.building_size?.size;

      return {
        ...p,
        beds: p?.beds ?? p?.bedrooms ?? desc?.beds ?? null,
        baths: bathsNum ?? null,
        building_size: p?.building_size?.size ? p.building_size : (sqft ? { size: sqft } : undefined),
        location: {
          ...(location || {}),
          address: {
            line: addr?.line || [addr?.street, addr?.city, addr?.state_code, addr?.postal_code].filter(Boolean).join(', '),
            city: addr?.city,
            state_code: addr?.state_code || addr?.state,
            postal_code: addr?.postal_code,
            street: addr?.street,
            coordinate: addr?.coordinate,
          },
        },
        photos: primaryPhoto ? [{ href: primaryPhoto }, ...photos.filter((ph: any) => ph?.href && ph.href !== primaryPhoto)] : photos,
        primary_photo: primaryPhoto ? { href: primaryPhoto } : p?.primary_photo,
      };
    });

    // Note: If the API doesn't support certain filters (like beds/baths), 
    // the client-side filtering in MapAndResults will handle the filtering
    return NextResponse.json({ results: normalized });
  } catch (err: any) {
    console.error('Error in /api/realtor:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}

// Convenience GET to fetch full details for a single property by id
export async function GET(req: NextRequest) {
  if (!RAPIDAPI_KEY) {
    console.error('RapidAPI key not configured. Set RAPIDAPI_KEY or REALTOR_RAPIDAPI_KEY.');
    return NextResponse.json({ error: 'Server configuration error: Missing RAPIDAPI_KEY' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id') || searchParams.get('property_id');
    if (!id) {
      return NextResponse.json({ error: 'Missing query parameter: id' }, { status: 400 });
    }

    const url = REALTOR_DETAILS_URL(id);
    console.log('[RealtorAPI GET] Requesting details:', { id, url });

    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': REALTOR_API_HOST,
      },
      cache: 'no-store',
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    let data: any; try { data = isJson ? JSON.parse(text) : text; } catch { data = text; }

    console.log('[RealtorAPI GET] Upstream response:', {
      status: upstream.status,
      ok: upstream.ok,
      contentType,
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream Realtor API error', details: data }, { status: upstream.status });
    }

    // Return the upstream body as-is so the client has "all the info"
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error in /api/realtor GET:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}

function safeStringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return '[unserializable]';
  }
}

function summarizeData(data: any): any {
  if (data == null) return { type: 'nullish' };
  if (typeof data === 'string') return { type: 'string', length: data.length };
  if (Array.isArray(data)) return { type: 'array', length: data.length };
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    const firstKey = keys[0];
    const firstVal = firstKey ? (Array.isArray((data as any)[firstKey]) ? { key: firstKey, length: (data as any)[firstKey].length, type: 'array' } : { key: firstKey, type: typeof (data as any)[firstKey] }) : undefined;
    return { type: 'object', keysCount: keys.length, firstField: firstVal };
  }
  return { type: typeof data };
}

// removed mock results; API now only returns real upstream data or errors


