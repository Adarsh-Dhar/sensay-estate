"use client"

import { useMemo, useState } from "react"
import { MapAndResults } from "@/components/map-and-results"
import { useSearchParams } from "next/navigation"

type Property = {
  id: string
  address: string
  rent: number | null
  bhk: number | null
  sqft: number | null
  type: string | null
  image: string | null
  coordinates: {
    lat: number | null
    lng: number | null
  }
}

export default function Page() {
  const [properties, setProperties] = useState<Property[]>([])
  const searchParams = useSearchParams()

  const derivedFilters = useMemo(() => {
    if (!searchParams) return undefined
    const location = searchParams.get("location") || undefined
    const radiusParam = searchParams.get("radius")
    const radius = radiusParam != null ? Number(radiusParam) : undefined
    const rent_max = searchParams.get("rent_max")
    const rent_min = searchParams.get("rent_min")
    const price_max = searchParams.get("price_max")
    const price_min = searchParams.get("price_min")
    const beds_min = searchParams.get("beds_min")
    const property_type = searchParams.get("property_type") || undefined

    // Translate to RealtorFilters shape for our /api/realtor endpoint
    const query: any = {}
    if (location) {
      query.search_location = { location, ...(typeof radius === 'number' && !Number.isNaN(radius) ? { radius } : { radius: 2 }) }
      // Also include address for exact matching when a full address is provided
      query.address = location
    }
    // Rental vs purchase ranges
    if (rent_max || rent_min) {
      // Rentals: upstream often uses list_price for for-sale; for rentals we keep as keywords for now
      // Keep placeholders to avoid breaking; actual rental endpoint not wired
    }
    if (price_max || price_min) {
      query.list_price = {
        ...(price_min ? { min: Number(price_min) } : {}),
        ...(price_max ? { max: Number(price_max) } : {}),
      }
    }
    if (beds_min) {
      query.beds = { min: Number(beds_min) }
    }
    if (property_type) {
      query.type = [property_type]
    } else {
      // Default to apartments and condos for rental searches
      query.type = ['apartment', 'condo_townhome']
    }

    return Object.keys(query).length ? { query: { ...query, status: ["for_sale", "for_rent"] } } : undefined
  }, [searchParams])

  return (
    <main className="h-screen flex flex-col md:flex-row">

      <section className="w-full md:w-[65%] flex-1 bg-background">
        <MapAndResults filters={derivedFilters as any} properties={properties} />
      </section>
    </main>
  )
}
