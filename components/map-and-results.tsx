"use client"

import { MapPlaceholder } from "./map-placeholder"
import { PropertyCard } from "./property-card"
import { useEffect, useMemo, useState } from "react"

type RealtorFilters = {
  limit?: number
  offset?: number
  state_code?: string
  city?: string
  street_name?: string
  address?: string
  postal_code?: string
  agent_source_id?: string
  selling_agent_name?: string
  source_listing_id?: string
  property_id?: string
  fulfillment_id?: string
  search_location?: { radius?: number; location?: string }
  radius?: number
  location?: string
  status?: string[]
  type?: string[]
  keywords?: string[] | string
  boundary?: any
  baths?: { min?: number; max?: number }
  beds?: { min?: number; max?: number }
  open_house?: { min?: string; max?: string }
  year_built?: { min?: number; max?: number }
  sold_price?: { min?: number; max?: number }
  sold_date?: { min?: string; max?: string }
  list_price?: { min?: number; max?: number }
  lot_sqft?: { min?: number; max?: number }
  sqft?: { min?: number; max?: number }
  hoa_fee?: { min?: number; max?: number }
  no_hoa_fee?: boolean
  pending?: boolean
  contingent?: boolean
  foreclosure?: boolean
  has_tour?: boolean
  new_construction?: boolean
  cats?: boolean
  dogs?: boolean
  matterport?: boolean
  sort?: { direction?: "asc" | "desc"; field?: string }
  direction?: "asc" | "desc"
  field?: string
}

type IncomingProperty = {
  id?: string
  address?: string
  rent?: number | null
  bhk?: number | null
  sqft?: number | null
  type?: string | null
  image?: string | null
  coordinates?: { lat: number | null; lng: number | null }
}

type MapAndResultsProps = {
  filters?: RealtorFilters
  properties?: IncomingProperty[]
}

export function MapAndResults({ filters, properties }: MapAndResultsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<any[]>([])

  const payload = useMemo(() => filters || { status: ["for_sale"], limit: 12 }, [filters])

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
        console.log("data",data)
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

  // Convert API items to PropertyCard format defensively
  const propertyCards = items.map((it: any) => {
    // Prefer inbound properties shape first
    const inboundPrice = it?.rent ?? null
    const inboundBeds = it?.bhk ?? null
    const inboundSqft = it?.sqft ?? null
    const inboundAddress = it?.address ?? null
    const inboundImage = it?.image ?? null
    const inboundType = it?.type ?? null

    const price = inboundPrice ?? it?.list_price ?? it?.price ?? null
    const beds = inboundBeds ?? it?.beds ?? it?.bedrooms ?? null
    const sqft = inboundSqft ?? it?.building_size?.size ?? it?.sqft ?? it?.living_area ?? null
    const addressLine = inboundAddress || it?.location?.address?.line || it?.address?.line || it?.address ||
      [it?.location?.address?.street, it?.location?.address?.city, it?.location?.address?.state_code, it?.location?.address?.postal_code]
        .filter(Boolean)
        .join(", ")
    const imageUrl = inboundImage || it?.photos?.[0]?.href || it?.primary_photo?.href || it?.photo || "/placeholder.jpg"
    const type = Array.isArray(it?.description?.type) ? it.description.type.join(", ") : (inboundType || it?.description?.type || it?.prop_type || null)
    const status = it?.status || it?.listing_status || null
    const baths = it?.baths ?? it?.bathrooms ?? null

    // Attempt to extract a stable Realtor property_id
    const id = it?.property_id || it?.property_id_str || it?.property?.property_id || it?.id || undefined

    return {
      id,
      imageUrl,
      price: price ? `$${Number(price).toLocaleString()}` : "Price not available",
      address: addressLine || "Address not available",
      beds: beds ? `${beds} beds` : "Beds not specified",
      area: sqft ? `${sqft} sqft` : "Area not specified",
      highlights: [
        status ? `Status: ${status}` : null,
        type ? `Type: ${type}` : null,
        baths ? `Baths: ${baths}` : null,
      ].filter(Boolean) as string[],
    }
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
