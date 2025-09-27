import { PropertyFilters } from "@/types/property"

export interface SearchRequest {
  action: "search"
  filters: {
    location?: string | null
    rent_max?: number | null
    rent_min?: number | null
    price_max?: number | null
    price_min?: number | null
    beds_min?: number | null
    beds_max?: number | null
    baths_min?: number | null
    baths_max?: number | null
    property_type?: string | null
    hoa_max?: number | null
    hoa_min?: number | null
    radius?: number | null
    sqft_min?: number | null
    sqft_max?: number | null
    year_built_min?: number | null
    year_built_max?: number | null
  }
}

// Helper function to extract postal code from address
function extractPostalCode(address: string): string | null {
  // Match 5-digit postal code at the end of the address
  const zipMatch = address.match(/\b(\d{5})\b/)
  return zipMatch ? zipMatch[1] : null
}

// Helper function to extract city and state from address
function extractCityState(address: string): { city: string; state: string } | null {
  // Match common patterns like "City, State" or "City, ST"
  const cityStateMatch = address.match(/([^,]+),\s*([A-Z]{2})\b/)
  if (cityStateMatch) {
    return {
      city: cityStateMatch[1].trim(),
      state: cityStateMatch[2].trim()
    }
  }
  return null
}

export function parseSearchRequest(request: SearchRequest): {
  filters: PropertyFilters
  searchLocation?: {
    location: string
    radius: number
  }
  redirectUrl: string
} {
  const { filters: requestFilters } = request
  
  // Default radius is 5 miles if not specified
  const radius = requestFilters.radius || 5
  
  // Parse location if provided
  const searchLocation = requestFilters.location ? {
    location: requestFilters.location,
    radius
  } : undefined

  // Build PropertyFilters object
  const filters: PropertyFilters = {
    limit: 100,
    status: ["for_sale"]
  }

  // Extract postal code and city/state from location if provided
  if (requestFilters.location) {
    const postalCode = extractPostalCode(requestFilters.location)
    const cityState = extractCityState(requestFilters.location)
    
    if (postalCode) {
      filters.zipCode = postalCode
    } else if (cityState) {
      filters.city = cityState.city
      filters.state = cityState.state
    }
  }

  // Price filters (rent or sale price)
  if (requestFilters.rent_min || requestFilters.price_min) {
    filters.minPrice = requestFilters.rent_min || requestFilters.price_min || undefined
  }
  if (requestFilters.rent_max || requestFilters.price_max) {
    filters.maxPrice = requestFilters.rent_max || requestFilters.price_max || undefined
  }

  // Property details
  if (requestFilters.beds_min !== undefined && requestFilters.beds_min !== null) {
    filters.minBeds = requestFilters.beds_min
  }
  if (requestFilters.beds_max !== undefined && requestFilters.beds_max !== null) {
    filters.maxBeds = requestFilters.beds_max
  }
  if (requestFilters.baths_min !== undefined && requestFilters.baths_min !== null) {
    filters.minBaths = requestFilters.baths_min
  }
  if (requestFilters.baths_max !== undefined && requestFilters.baths_max !== null) {
    filters.maxBaths = requestFilters.baths_max
  }
  if (requestFilters.sqft_min !== undefined && requestFilters.sqft_min !== null) {
    filters.minSqft = requestFilters.sqft_min
  }
  if (requestFilters.sqft_max !== undefined && requestFilters.sqft_max !== null) {
    filters.maxSqft = requestFilters.sqft_max
  }
  if (requestFilters.year_built_min !== undefined && requestFilters.year_built_min !== null) {
    filters.minYearBuilt = requestFilters.year_built_min
  }
  if (requestFilters.year_built_max !== undefined && requestFilters.year_built_max !== null) {
    filters.maxYearBuilt = requestFilters.year_built_max
  }

  // Property type
  if (requestFilters.property_type) {
    filters.propertyType = [requestFilters.property_type]
  }

  // HOA fees
  if (requestFilters.hoa_max !== undefined && requestFilters.hoa_max !== null) {
    filters.maxHOA = requestFilters.hoa_max
    filters.hasHOA = true // Only show properties with HOA if max is specified
  }
  if (requestFilters.hoa_min !== undefined && requestFilters.hoa_min !== null) {
    filters.minHOA = requestFilters.hoa_min
    filters.hasHOA = true
  }

  // Create redirect URL
  const redirectUrl = createSearchUrl(filters, searchLocation)

  return {
    filters,
    searchLocation,
    redirectUrl
  }
}

export function createSearchUrl(filters: PropertyFilters, searchLocation?: { location: string; radius: number }): string {
  const params = new URLSearchParams()
  
  // Add search location if provided
  if (searchLocation) {
    params.set('search_location', JSON.stringify(searchLocation))
  }
  
  // Add filters
  if (filters.minPrice) params.set('minPrice', filters.minPrice.toString())
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice.toString())
  if (filters.minBeds) params.set('minBeds', filters.minBeds.toString())
  if (filters.maxBeds) params.set('maxBeds', filters.maxBeds.toString())
  if (filters.minBaths) params.set('minBaths', filters.minBaths.toString())
  if (filters.maxBaths) params.set('maxBaths', filters.maxBaths.toString())
  if (filters.minSqft) params.set('minSqft', filters.minSqft.toString())
  if (filters.maxSqft) params.set('maxSqft', filters.maxSqft.toString())
  if (filters.minYearBuilt) params.set('minYearBuilt', filters.minYearBuilt.toString())
  if (filters.maxYearBuilt) params.set('maxYearBuilt', filters.maxYearBuilt.toString())
  if (filters.propertyType) params.set('propertyType', filters.propertyType.join(','))
  if (filters.status) params.set('status', filters.status.join(','))
  if (filters.city) params.set('city', filters.city)
  if (filters.state) params.set('state', filters.state)
  if (filters.zipCode) params.set('zipCode', filters.zipCode)
  if (filters.neighborhood) params.set('neighborhood', filters.neighborhood)
  if (filters.hasGarage) params.set('hasGarage', 'true')
  if (filters.hasPool) params.set('hasPool', 'true')
  if (filters.hasElevator) params.set('hasElevator', 'true')
  if (filters.hasHOA) params.set('hasHOA', 'true')
  if (filters.minHOA) params.set('minHOA', filters.minHOA.toString())
  if (filters.maxHOA) params.set('maxHOA', filters.maxHOA.toString())
  if (filters.isNewConstruction) params.set('isNewConstruction', 'true')
  if (filters.isPending) params.set('isPending', 'true')
  if (filters.isForeclosure) params.set('isForeclosure', 'true')
  if (filters.isPriceReduced) params.set('isPriceReduced', 'true')
  if (filters.isNewListing) params.set('isNewListing', 'true')
  if (filters.allowsCats) params.set('allowsCats', 'true')
  if (filters.allowsDogs) params.set('allowsDogs', 'true')
  if (filters.minSchoolRating) params.set('minSchoolRating', filters.minSchoolRating.toString())
  if (filters.schoolType) params.set('schoolType', filters.schoolType.join(','))
  if (filters.hasVirtualTour) params.set('hasVirtualTour', 'true')
  if (filters.hasMatterport) params.set('hasMatterport', 'true')
  if (filters.hasOpenHouse) params.set('hasOpenHouse', 'true')
  if (filters.limit) params.set('limit', filters.limit.toString())

  return `/?${params.toString()}`
}

export function parseUrlFilters(searchParams: URLSearchParams): {
  filters: PropertyFilters
  searchLocation?: { location: string; radius: number }
} {
  const filters: PropertyFilters = {
    status: ["for_sale"],
    limit: 100
  }

  // Parse search location
  let searchLocation: { location: string; radius: number } | undefined
  const searchLocationParam = searchParams.get('search_location')
  if (searchLocationParam) {
    try {
      searchLocation = JSON.parse(searchLocationParam)
    } catch (e) {
      console.error('Failed to parse search_location:', e)
    }
  }

  // Parse other filters
  if (searchParams.get('minPrice')) filters.minPrice = Number(searchParams.get('minPrice'))
  if (searchParams.get('maxPrice')) filters.maxPrice = Number(searchParams.get('maxPrice'))
  if (searchParams.get('minBeds')) filters.minBeds = Number(searchParams.get('minBeds'))
  if (searchParams.get('maxBeds')) filters.maxBeds = Number(searchParams.get('maxBeds'))
  if (searchParams.get('minBaths')) filters.minBaths = Number(searchParams.get('minBaths'))
  if (searchParams.get('maxBaths')) filters.maxBaths = Number(searchParams.get('maxBaths'))
  if (searchParams.get('minSqft')) filters.minSqft = Number(searchParams.get('minSqft'))
  if (searchParams.get('maxSqft')) filters.maxSqft = Number(searchParams.get('maxSqft'))
  if (searchParams.get('minYearBuilt')) filters.minYearBuilt = Number(searchParams.get('minYearBuilt'))
  if (searchParams.get('maxYearBuilt')) filters.maxYearBuilt = Number(searchParams.get('maxYearBuilt'))
  if (searchParams.get('propertyType')) filters.propertyType = searchParams.get('propertyType')!.split(',')
  if (searchParams.get('status')) filters.status = searchParams.get('status')!.split(',')
  if (searchParams.get('city')) filters.city = searchParams.get('city')
  if (searchParams.get('state')) filters.state = searchParams.get('state')
  if (searchParams.get('zipCode')) filters.zipCode = searchParams.get('zipCode')
  if (searchParams.get('neighborhood')) filters.neighborhood = searchParams.get('neighborhood')
  if (searchParams.get('hasGarage') === 'true') filters.hasGarage = true
  if (searchParams.get('hasPool') === 'true') filters.hasPool = true
  if (searchParams.get('hasElevator') === 'true') filters.hasElevator = true
  if (searchParams.get('hasHOA') === 'true') filters.hasHOA = true
  if (searchParams.get('minHOA')) filters.minHOA = Number(searchParams.get('minHOA'))
  if (searchParams.get('maxHOA')) filters.maxHOA = Number(searchParams.get('maxHOA'))
  if (searchParams.get('isNewConstruction') === 'true') filters.isNewConstruction = true
  if (searchParams.get('isPending') === 'true') filters.isPending = true
  if (searchParams.get('isForeclosure') === 'true') filters.isForeclosure = true
  if (searchParams.get('isPriceReduced') === 'true') filters.isPriceReduced = true
  if (searchParams.get('isNewListing') === 'true') filters.isNewListing = true
  if (searchParams.get('allowsCats') === 'true') filters.allowsCats = true
  if (searchParams.get('allowsDogs') === 'true') filters.allowsDogs = true
  if (searchParams.get('minSchoolRating')) filters.minSchoolRating = Number(searchParams.get('minSchoolRating'))
  if (searchParams.get('schoolType')) filters.schoolType = searchParams.get('schoolType')!.split(',')
  if (searchParams.get('hasVirtualTour') === 'true') filters.hasVirtualTour = true
  if (searchParams.get('hasMatterport') === 'true') filters.hasMatterport = true
  if (searchParams.get('hasOpenHouse') === 'true') filters.hasOpenHouse = true
  if (searchParams.get('limit')) filters.limit = Number(searchParams.get('limit'))

  return { filters, searchLocation }
}
