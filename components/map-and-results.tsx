import { MapPlaceholder } from "./map-placeholder"
import { PropertyCard } from "./property-card"

const properties = [
  {
    imageUrl: "/modern-3bhk-apartment-exterior.jpg",
    price: "₹14,500 / month",
    address: "HAL 2nd Stage, Indiranagar",
    beds: "3 BHK",
    area: "1200 sqft",
    highlights: ["Walk Score: 9/10", "Nearby Cafe", "Top-rated School"],
  },
  {
    imageUrl: "/bright-living-room-with-balcony.jpg",
    price: "₹16,000 / month",
    address: "80 Feet Road, Indiranagar",
    beds: "3 BHK",
    area: "1250 sqft",
    highlights: ["Parks Nearby", "Quiet Street", "Metro Access"],
  },
  {
    imageUrl: "/neighborhood-street-tree-lined.jpg",
    price: "₹15,200 / month",
    address: "HAL 3rd Stage, Indiranagar",
    beds: "3 BHK",
    area: "1180 sqft",
    highlights: ["Walk Score: 8/10", "Grocery Close", "Play Area"],
  },
]

export function MapAndResults() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <MapPlaceholder />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-balance text-lg font-semibold">Search Results</h2>
          <p className="text-sm text-muted-foreground">{properties.length} properties found</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((p, idx) => (
            <PropertyCard key={idx} {...p} />
          ))}
        </div>
      </div>
    </div>
  )
}
