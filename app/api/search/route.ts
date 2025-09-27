import { NextRequest, NextResponse } from "next/server"
import { parseSearchRequest, createSearchUrl } from "@/lib/search-handler"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Parse the search request
    const { redirectUrl } = parseSearchRequest(body)
    
    // Redirect to home page with filters applied
    return NextResponse.redirect(new URL(redirectUrl, request.url))
    
  } catch (error) {
    console.error('Search request error:', error)
    return NextResponse.json(
      { error: 'Invalid search request' },
      { status: 400 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse URL parameters to create search request
    const location = searchParams.get('location')
    const radius = searchParams.get('radius') ? Number(searchParams.get('radius')) : 5
    const priceMax = searchParams.get('price_max') ? Number(searchParams.get('price_max')) : null
    const priceMin = searchParams.get('price_min') ? Number(searchParams.get('price_min')) : null
    const bedsMin = searchParams.get('beds_min') ? Number(searchParams.get('beds_min')) : null
    const bedsMax = searchParams.get('beds_max') ? Number(searchParams.get('beds_max')) : null
    const bathsMin = searchParams.get('baths_min') ? Number(searchParams.get('baths_min')) : null
    const bathsMax = searchParams.get('baths_max') ? Number(searchParams.get('baths_max')) : null
    const propertyType = searchParams.get('property_type')
    const hoaMax = searchParams.get('hoa_max') ? Number(searchParams.get('hoa_max')) : null
    const hoaMin = searchParams.get('hoa_min') ? Number(searchParams.get('hoa_min')) : null
    const sqftMin = searchParams.get('sqft_min') ? Number(searchParams.get('sqft_min')) : null
    const sqftMax = searchParams.get('sqft_max') ? Number(searchParams.get('sqft_max')) : null
    const yearBuiltMin = searchParams.get('year_built_min') ? Number(searchParams.get('year_built_min')) : null
    const yearBuiltMax = searchParams.get('year_built_max') ? Number(searchParams.get('year_built_max')) : null
    
    const searchRequest = {
      action: "search" as const,
      filters: {
        location,
        radius,
        price_max: priceMax,
        price_min: priceMin,
        beds_min: bedsMin,
        beds_max: bedsMax,
        baths_min: bathsMin,
        baths_max: bathsMax,
        property_type: propertyType,
        hoa_max: hoaMax,
        hoa_min: hoaMin,
        sqft_min: sqftMin,
        sqft_max: sqftMax,
        year_built_min: yearBuiltMin,
        year_built_max: yearBuiltMax
      }
    }
    
    // Parse the search request
    const { redirectUrl } = parseSearchRequest(searchRequest)
    
    // Redirect to home page with filters applied
    return NextResponse.redirect(new URL(redirectUrl, request.url))
    
  } catch (error) {
    console.error('Search request error:', error)
    return NextResponse.json(
      { error: 'Invalid search request' },
      { status: 400 }
    )
  }
}
