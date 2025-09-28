"use client"

import { PropertyCard } from "./property-card"
import { useEffect, useMemo, useState } from "react"
import { Property, PropertyFilters as PropertyFiltersType } from "@/types/property"
import { convertToRealtorFilters, filterProperties, convertPropertyToCardData } from "@/lib/property-filters"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"

// Distance calculation utilities
interface Coordinates {
  lat: number
  lon: number
}

function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRadians(coord2.lat - coord1.lat)
  const dLon = toRadians(coord2.lon - coord1.lon)
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) * Math.cos(toRadians(coord2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

function getCoordinatesForAddress(address: string): Coordinates | null {
  const knownAddresses: Record<string, Coordinates> = {
    "2577 Harrison St Unit 1, San Francisco, CA, 94110": {
      lat: 37.756242,
      lon: -122.411929
    },
    "1645-1649 Sacramento St, San Francisco, CA, 94109": {
      lat: 37.7946,
      lon: -122.4090
    },
    // Add more common addresses for testing
    "2577 Harrison St, San Francisco, CA, 94110": {
      lat: 37.756242,
      lon: -122.411929
    },
    "Harrison St, San Francisco, CA, 94110": {
      lat: 37.756242,
      lon: -122.411929
    }
  }
  
  // Try exact match first
  if (knownAddresses[address]) {
    return knownAddresses[address]
  }
  
  // Try to extract coordinates from the first property if it's in the same postal code
  // This is a fallback for when we don't have the exact address
  console.log('Address not found in known addresses:', address)
  return null
}

function filterPropertiesByRadius(
  properties: any[],
  referenceLocation: Coordinates,
  radiusMiles: number
): any[] {
  return properties.filter(property => {
    if (!property.location?.address?.coordinate) {
      return false // Skip properties without coordinates
    }
    
    const propertyCoords: Coordinates = {
      lat: property.location.address.coordinate.lat,
      lon: property.location.address.coordinate.lon
    }
    
    const distance = calculateDistance(referenceLocation, propertyCoords)
    return distance <= radiusMiles
  })
}

type MapAndResultsProps = {
  filters?: PropertyFiltersType
  properties?: Property[]
  searchLocation?: { location: string; radius: number }
}

export function MapAndResults({ filters, properties, searchLocation }: MapAndResultsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Property[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  const payload = useMemo(() => {
    const defaultFilters = { status: ["for_sale"], limit: 100 }
    const realtorFilters = filters ? convertToRealtorFilters(filters) : defaultFilters
    
    // Note: search_location is not supported by the API, so we rely on postal_code, city, and state
    // which are already handled in convertToRealtorFilters
    
    return realtorFilters
  }, [filters, searchLocation])

  useEffect(() => {
    let isMounted = true
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/realtor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        console.log("data", data)
        if (!res.ok) throw new Error(data?.error || "Failed to load properties")
        
        // Try common shapes from Realtor API wrappers
        const list = (data?.data as any[]) || (data?.results as any[]) || (data?.properties as any[]) || (data?.listings as any[]) || []
        if (isMounted) setItems(Array.isArray(list) ? list : [])
      } catch (e: any) {
        if (isMounted) setError(e?.message || "Something went wrong")
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    run()
    return () => {
      isMounted = false
    }
  }, [payload, properties])

  // Apply client-side filtering if needed
  const filteredItems = useMemo(() => {
    let filtered = items
    
    // Apply radius filtering if searchLocation is provided
    if (searchLocation && searchLocation.location && searchLocation.radius) {
      let referenceCoords = getCoordinatesForAddress(searchLocation.location)
      
      // Fallback: if we don't have coordinates for the specific address,
      // use the first property's coordinates as a reference point
      if (!referenceCoords && filtered.length > 0) {
        const firstProperty = filtered[0]
        if (firstProperty?.location?.address?.coordinate) {
          referenceCoords = {
            lat: firstProperty.location.address.coordinate.lat,
            lon: firstProperty.location.address.coordinate.lon
          }
          console.log('Using first property as reference point:', referenceCoords)
        }
      }
      
      console.log('Radius filtering debug:', {
        searchLocation: searchLocation.location,
        radius: searchLocation.radius,
        referenceCoords,
        totalProperties: filtered.length
      })
      
      if (referenceCoords) {
        filtered = filterPropertiesByRadius(filtered, referenceCoords, searchLocation.radius)
        console.log('After radius filtering:', filtered.length, 'properties')
      } else {
        console.log('No coordinates found for address, skipping radius filtering')
      }
    }
    
    // Apply other filters
    if (filters) {
      filtered = filterProperties(filtered, filters)
    }
    
    return filtered
  }, [items, filters, searchLocation])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, searchLocation])

  // Calculate pagination
  const totalItems = filteredItems.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  // Convert API items to PropertyCard format
  const propertyCards = paginatedItems.map((property: Property) => {
    return convertPropertyToCardData(property)
  })

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top of results when changing pages
    const resultsElement = document.getElementById('search-results')
    if (resultsElement) {
      resultsElement.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1)
    }
  }
  return (
    <div className="flex h-full flex-col gap-4 p-4">

      <div id="search-results">
        <div className="mb-3 flex items-center justify-between">
          <div>
          <h2 className="text-balance text-lg font-semibold">Search Results</h2>
            {searchLocation && (
              <p className="text-sm text-muted-foreground">
                Properties near <span className="font-medium">{searchLocation.location}</span>
                <span className="ml-1">(within {searchLocation.radius} miles)</span>
                {filters?.zipCode && (
                  <span className="ml-1 text-xs">from {filters.zipCode} area</span>
                )}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {totalItems} properties found
            </p>
            {totalPages > 1 && (
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">Loading properties…</div>
        ) : error ? (
          <div className="flex h-32 items-center justify-center text-destructive">{error}</div>
        ) : propertyCards.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {propertyCards.map((p, idx) => (
                <PropertyCard key={idx} {...p} />
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          handlePreviousPage()
                        }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {/* Page numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and pages around current page
                      const shouldShow = 
                        page === 1 || 
                        page === totalPages || 
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      
                      if (!shouldShow) {
                        // Show ellipsis for gaps
                        if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        return null
                      }
                      
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              handlePageChange(page)
                            }}
                            isActive={page === currentPage}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          handleNextPage()
                        }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <p>No properties found. Try asking about a specific location or property type!</p>
          </div>
        )}
      </div>
    </div>
  )
}
