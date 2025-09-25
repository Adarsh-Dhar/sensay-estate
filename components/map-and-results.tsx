import { MapPlaceholder } from "./map-placeholder"
import { PropertyCard } from "./property-card"

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

type MapAndResultsProps = {
  properties: Property[]
}

export function MapAndResults({ properties }: MapAndResultsProps) {
  // Convert API properties to PropertyCard format
  const propertyCards = properties.map((prop) => ({
    imageUrl: prop.image || "/placeholder.jpg",
    price: prop.rent ? `$${prop.rent.toLocaleString()} / month` : "Price not available",
    address: prop.address,
    beds: prop.bhk ? `${prop.bhk} BHK` : "Beds not specified",
    area: prop.sqft ? `${prop.sqft} sqft` : "Area not specified",
    highlights: [
      prop.type ? `Type: ${prop.type}` : null,
      prop.coordinates.lat && prop.coordinates.lng ? "Location available" : null,
    ].filter(Boolean) as string[],
  }))
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

        {propertyCards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {propertyCards.map((p, idx) => (
              <PropertyCard key={properties[idx]?.id || idx} {...p} />
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
