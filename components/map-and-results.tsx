"use client"

import { MapPlaceholder } from "./map-placeholder"
import { PropertyCard } from "./property-card"
import { useEffect, useMemo, useState } from "react"
import { Property, PropertyFilters as PropertyFiltersType } from "@/types/property"
import { convertToRealtorFilters, filterProperties, convertPropertyToCardData } from "@/lib/property-filters"

type MapAndResultsProps = {
  filters?: PropertyFiltersType
  properties?: Property[]
}

export function MapAndResults({ filters, properties }: MapAndResultsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Property[]>([])

  const payload = useMemo(() => {
    const defaultFilters = { status: ["for_sale"], limit: 12 }
    return filters ? convertToRealtorFilters(filters) : defaultFilters
  }, [filters])

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
    if (!filters) return items
    return filterProperties(items, filters)
  }, [items, filters])

  // Convert API items to PropertyCard format
  const propertyCards = filteredItems.map((property: Property) => {
    return convertPropertyToCardData(property)
  })
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <MapPlaceholder />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-balance text-lg font-semibold">Search Results</h2>
          <p className="text-sm text-muted-foreground">{propertyCards.length} properties found</p>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">Loading properties…</div>
        ) : error ? (
          <div className="flex h-32 items-center justify-center text-destructive">{error}</div>
        ) : propertyCards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {propertyCards.map((p, idx) => (
              <PropertyCard key={idx} {...p} />
            ))}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <p>No properties found. Try asking about a specific location or property type!</p>
          </div>
        )}
      </div>
    </div>
  )
}
