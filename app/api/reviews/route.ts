import { NextResponse } from 'next/server';

// This is the main handler for your API route.
export async function POST(request: Request) {
  try {
    const { query, latitude, longitude, radius = 3 } = await request.json();

    if (!query && (!latitude || !longitude)) {
      return NextResponse.json({ error: 'A location query or coordinates are required.' }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleApiKey) {
        throw new Error("Google Maps API key is not configured.");
    }

    let allReviews: Array<{text: string, rating: number, placeName: string}> = [];
    let locationName = query || 'this area';

    // If coordinates are provided, search for neighborhood/area reviews within radius
    if (latitude && longitude) {
      console.log(`Searching for reviews within ${radius} miles of ${latitude}, ${longitude}`);
      
      // Search for neighborhood/area names first
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleApiKey}`;
      const geocodeRes = await fetch(geocodeUrl);
      
      if (geocodeRes.ok) {
        const geocodeData = await geocodeRes.json();
        if (geocodeData.results && geocodeData.results.length > 0) {
          const result = geocodeData.results[0];
          const neighborhood = result.address_components?.find((c: any) => 
            c.types.includes('neighborhood') || c.types.includes('sublocality')
          )?.long_name;
          const city = result.address_components?.find((c: any) => 
            c.types.includes('locality')
          )?.long_name;
          
          if (neighborhood) {
            locationName = `${neighborhood}, ${city || ''}`;
          } else {
            locationName = result.formatted_address;
          }
        }
      }

      // Search for nearby places with reviews (restaurants, cafes, parks, etc.)
      const nearbySearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius * 1609}&type=establishment&key=${googleApiKey}`;
      const nearbyRes = await fetch(nearbySearchUrl);
      
      if (nearbyRes.ok) {
        const nearbyData = await nearbyRes.json();
        if (nearbyData.results && nearbyData.results.length > 0) {
          // Get reviews from top 5 nearby places
          const topPlaces = nearbyData.results.slice(0, 5);
          
          for (const place of topPlaces) {
            try {
              const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,review,rating&key=${googleApiKey}`;
              const detailsRes = await fetch(detailsUrl);
              
              if (detailsRes.ok) {
                const detailsData = await detailsRes.json();
                if (detailsData.result && detailsData.result.reviews) {
                  const placeReviews = detailsData.result.reviews.map((review: any) => ({
                    text: review.text,
                    rating: review.rating,
                    placeName: detailsData.result.name
                  })).filter((review: any) => review.text && review.text.trim());
                  
                  allReviews = allReviews.concat(placeReviews);
                }
              }
            } catch (error) {
              console.log(`Error fetching reviews for place ${place.place_id}:`, error);
            }
          }
        }
      }
    }

    // If no reviews found from nearby search, try the original query method
    if (allReviews.length === 0 && query) {
      console.log(`No nearby reviews found, trying direct query for: ${query}`);
      
      const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${googleApiKey}`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (searchData.status === 'OK' && searchData.candidates && searchData.candidates.length > 0) {
        const placeId = searchData.candidates[0].place_id;
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,review,rating&key=${googleApiKey}`;
        
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        if (detailsData.status === 'OK' && detailsData.result && detailsData.result.reviews) {
          allReviews = detailsData.result.reviews.map((review: any) => ({
            text: review.text,
            rating: review.rating,
            placeName: detailsData.result.name
          })).filter((review: any) => review.text && review.text.trim());
        }
      }
    }

    if (allReviews.length === 0) {
      return NextResponse.json({ 
        summary: `Found "${locationName}", but there are no reviews available to summarize within a ${radius}-mile radius.`,
        source: locationName,
        reviewCount: 0
      });
    }


    // STEP 2: Use the Gemini API to summarize the reviews.
    const geminiApiKey = process.env.GEMINI_API_KEY;
     if (!geminiApiKey) {
        throw new Error("Gemini API key is not configured.");
    }
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
    
    // Extract review texts and create a more comprehensive prompt
    const reviewTexts = allReviews.map((review: any) => review.text);
    const averageRating = allReviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0) / allReviews.length;
    const uniquePlaces = [...new Set(allReviews.map((review: any) => review.placeName))];
    
    // We create a very specific prompt for the AI.
    const prompt = `
      You are an AI assistant that summarizes online reviews for a neighborhood/area.
      Based on the following reviews from ${uniquePlaces.length} different places in and around "${locationName}", provide a comprehensive summary of 2-4 sentences.
      Focus on the most common points about the area's atmosphere, amenities, safety, and overall livability. 
      Start your summary with "Residents and visitors often say..." and include insights about the neighborhood's character.

      Average rating across all places: ${averageRating.toFixed(1)}/5
      Reviews from places: ${uniquePlaces.join(', ')}

      Here are the reviews:
      ---
      ${reviewTexts.join('\n---\n')}
      ---
    `;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("Gemini API Error:", errorText);
        return NextResponse.json({ error: 'Failed to summarize reviews.' }, { status: 500 });
    }

    const geminiData = await geminiResponse.json();
    const summary = geminiData.candidates[0].content.parts[0].text;

    // STEP 3: Return the final summary.
    return NextResponse.json({ 
      summary: summary.trim(), 
      source: locationName, 
      reviewCount: allReviews.length,
      averageRating: averageRating.toFixed(1),
      placesReviewed: uniquePlaces.length
    });

  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
