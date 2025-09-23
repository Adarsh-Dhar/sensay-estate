import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';

export async function POST(req: NextRequest) {
  try {
    const { latitude, longitude } = await req.json();

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
    }
    
    if (!GOOGLE_MAPS_API_KEY) {
        console.error('Google Maps API Key is not configured.');
        return NextResponse.json({ error: 'Server configuration error: Missing API Key' }, { status: 500 });
    }

    // Define what we're searching for
    const searchConfig = {
      includedTypes: ["cafe", "school", "park", "bus_station"],
      maxResultCount: 5, // Max 5 results for each category
      locationRestriction: {
        circle: {
          center: {
            latitude: latitude,
            longitude: longitude,
          },
          radius: 1000.0, // 1 km radius
        },
      },
    };

    // Make the API call to Google Places
    const response = await fetch(PLACES_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.types'
        },
        body: JSON.stringify(searchConfig)
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('Google Places API Error:', error);
        throw new Error('Failed to fetch neighborhood data from Google');
    }

    const data = await response.json();

    // Process the response to be more frontend-friendly
    const neighborhoodData = {
      cafes: data.places?.filter((p: any) => p.types.includes('cafe')).map((p: any) => p.displayName.text) || [],
      schools: data.places?.filter((p: any) => p.types.includes('school')).map((p: any) => p.displayName.text) || [],
      parks: data.places?.filter((p: any) => p.types.includes('park')).map((p: any) => p.displayName.text) || [],
      transport: data.places?.filter((p: any) => p.types.includes('bus_station')).map((p: any) => p.displayName.text) || [],
    };
    
    return NextResponse.json(neighborhoodData);

  } catch (error) {
    console.error('Error in /api/neighborhood:', error);
    return NextResponse.json({ error: 'Failed to fetch neighborhood data' }, { status: 500 });
  }
}

