import { Property, PropertyFilters, School } from "@/types/property"

export function filterProperties(properties: Property[], filters: PropertyFilters): Property[] {
  return properties.filter(property => {
    // Price filters
    if (filters.minPrice && property.list_price < filters.minPrice) return false
    if (filters.maxPrice && property.list_price > filters.maxPrice) return false

    // Property details
    if (filters.minBeds && property.description.beds < filters.minBeds) return false
    if (filters.maxBeds && property.description.beds > filters.maxBeds) return false
    if (filters.minBaths && property.description.baths < filters.minBaths) return false
    if (filters.maxBaths && property.description.baths > filters.maxBaths) return false
    if (filters.minSqft && property.description.sqft && property.description.sqft < filters.minSqft) return false
    if (filters.maxSqft && property.description.sqft && property.description.sqft > filters.maxSqft) return false
    if (filters.minYearBuilt && property.description.year_built < filters.minYearBuilt) return false
    if (filters.maxYearBuilt && property.description.year_built > filters.maxYearBuilt) return false

    // Property type and status
    if (filters.propertyType && filters.propertyType.length > 0) {
      if (!filters.propertyType.includes(property.description.type)) return false
    }
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(property.status)) return false
    }

    // Location filters
    if (filters.city && !property.location.address.city.toLowerCase().includes(filters.city.toLowerCase())) return false
    if (filters.state && !property.location.address.state_code.toLowerCase().includes(filters.state.toLowerCase())) return false
    if (filters.zipCode && !property.location.address.postal_code.includes(filters.zipCode)) return false
    if (filters.neighborhood) {
      const neighborhoodMatch = property.location.neighborhoods.some(neighborhood => 
        neighborhood.name.toLowerCase().includes(filters.neighborhood!.toLowerCase())
      )
      if (!neighborhoodMatch) return false
    }

    // Features and amenities
    if (filters.hasGarage && !property.description.garage) return false
    if (filters.hasPool && !property.description.pool) return false
    if (filters.hasElevator) {
      const hasElevator = property.details.some(detail => 
        detail.category === "Interior Features" && 
        detail.text.some(text => text.toLowerCase().includes("elevator"))
      )
      if (!hasElevator) return false
    }
    if (filters.hasHOA && !property.hoa) return false
    if (filters.minHOA && (!property.hoa || property.hoa.fee < filters.minHOA)) return false
    if (filters.maxHOA && (!property.hoa || property.hoa.fee > filters.maxHOA)) return false

    // Special conditions
    if (filters.isNewConstruction && !property.flags.is_new_construction) return false
    if (filters.isPending && !property.flags.is_pending) return false
    if (filters.isForeclosure && !property.flags.is_foreclosure) return false
    if (filters.isPriceReduced && !property.flags.is_price_reduced) return false
    if (filters.isNewListing && !property.flags.is_new_listing) return false

    // Pet policy
    if (filters.allowsCats && property.pet_policy) {
      // This would need to be implemented based on the actual pet_policy structure
      // For now, we'll assume it's not available
    }
    if (filters.allowsDogs && property.pet_policy) {
      // This would need to be implemented based on the actual pet_policy structure
      // For now, we'll assume it's not available
    }

    // School filters
    if (filters.minSchoolRating || filters.schoolType) {
      const schools = property.schools?.schools || property.nearby_schools?.schools || []
      if (schools.length === 0) return false

      if (filters.minSchoolRating) {
        const hasGoodSchool = schools.some(school => 
          school.rating && school.rating >= filters.minSchoolRating!
        )
        if (!hasGoodSchool) return false
      }

      if (filters.schoolType && filters.schoolType.length > 0) {
        const hasMatchingSchoolType = schools.some(school => 
          filters.schoolType!.includes(school.funding_type)
        )
        if (!hasMatchingSchoolType) return false
      }
    }

    // Additional filters
    if (filters.hasVirtualTour && (!property.virtual_tours && property.home_tours.virtual_tours.length === 0)) return false
    if (filters.hasMatterport && !property.matterport) return false
    if (filters.hasOpenHouse && !property.open_houses) return false

    return true
  })
}

export function convertToRealtorFilters(filters: PropertyFilters): any {
  const realtorFilters: any = {
    status: filters.status || ["for_sale"],
    limit: 100
  }

  // Price filters
  if (filters.minPrice || filters.maxPrice) {
    realtorFilters.list_price = {}
    if (filters.minPrice) realtorFilters.list_price.min = filters.minPrice
    if (filters.maxPrice) realtorFilters.list_price.max = filters.maxPrice
  }

  // Property details
  if (filters.minBeds || filters.maxBeds) {
    realtorFilters.beds = {}
    if (filters.minBeds) realtorFilters.beds.min = filters.minBeds
    if (filters.maxBeds) realtorFilters.beds.max = filters.maxBeds
  }

  if (filters.minBaths || filters.maxBaths) {
    realtorFilters.baths = {}
    if (filters.minBaths) realtorFilters.baths.min = filters.minBaths
    if (filters.maxBaths) realtorFilters.baths.max = filters.maxBaths
  }

  if (filters.minSqft || filters.maxSqft) {
    realtorFilters.sqft = {}
    if (filters.minSqft) realtorFilters.sqft.min = filters.minSqft
    if (filters.maxSqft) realtorFilters.sqft.max = filters.maxSqft
  }

  if (filters.minYearBuilt || filters.maxYearBuilt) {
    realtorFilters.year_built = {}
    if (filters.minYearBuilt) realtorFilters.year_built.min = filters.minYearBuilt
    if (filters.maxYearBuilt) realtorFilters.year_built.max = filters.maxYearBuilt
  }

  // Property type
  if (filters.propertyType && filters.propertyType.length > 0) {
    realtorFilters.type = filters.propertyType
  }

  // Location filters
  if (filters.city) realtorFilters.city = filters.city
  if (filters.state) realtorFilters.state_code = filters.state
  if (filters.zipCode) realtorFilters.postal_code = filters.zipCode

  // HOA filters
  if (filters.minHOA || filters.maxHOA) {
    realtorFilters.hoa_fee = {}
    if (filters.minHOA) realtorFilters.hoa_fee.min = filters.minHOA
    if (filters.maxHOA) realtorFilters.hoa_fee.max = filters.maxHOA
  }

  // Special conditions
  if (filters.isNewConstruction) realtorFilters.new_construction = true
  if (filters.isPending) realtorFilters.pending = true
  if (filters.isForeclosure) realtorFilters.foreclosure = true

  // Pet policy
  if (filters.allowsCats) realtorFilters.cats = true
  if (filters.allowsDogs) realtorFilters.dogs = true

  // Additional filters
  if (filters.hasVirtualTour) realtorFilters.has_tour = true
  if (filters.hasMatterport) realtorFilters.matterport = true

  return realtorFilters
}

export function convertPropertyToCardData(property: Property): any {
  const price = property.list_price ? `$${Number(property.list_price).toLocaleString()}` : "Price not available"
  const address = property.location.address.line || "Address not available"
  const beds = property.description.beds ? `${property.description.beds} beds` : "Beds not specified"
  const area = property.description.sqft ? `${property.description.sqft} sqft` : "Area not specified"
  const baths = property.description.baths ? `${property.description.baths} baths` : "Baths not specified"
  const type = property.description.type || "Type not specified"
  const status = property.status || "Status not specified"
  
  const imageUrl = property.photos?.[0]?.href || "/placeholder.jpg"
  
  const highlights = [
    `Status: ${status}`,
    `Type: ${type}`,
    baths,
    property.hoa ? `HOA: $${property.hoa.fee.toLocaleString()}/month` : null,
    property.description.year_built ? `Built: ${property.description.year_built}` : null,
  ].filter(Boolean) as string[]

  return {
    id: property.property_id,
    imageUrl,
    price,
    address,
    beds,
    area,
    highlights,
  }
}
