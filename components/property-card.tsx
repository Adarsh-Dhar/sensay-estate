import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bed, Ruler } from "lucide-react"
import Link from "next/link"

type PropertyCardProps = {
  id?: string
  imageUrl: string
  price: string
  address: string
  beds: string
  area: string
  highlights: string[]
}

export function PropertyCard({ id, imageUrl, price, address, beds, area, highlights }: PropertyCardProps) {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        <div className="p-3">
          <img
            src={imageUrl || "/placeholder.svg"}
            alt={`Property at ${address}`}
            className="h-40 w-full rounded-lg object-cover"
          />
        </div>

        <div className="px-4 pb-4">
          <div className="mb-1 text-xl font-semibold">{price}</div>
          <div className="mb-3 text-sm text-muted-foreground">{address}</div>

          <div className="mb-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Bed className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="sr-only">Bedrooms</span>
              <span>{beds}</span>
            </div>
            <div className="flex items-center gap-1">
              <Ruler className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="sr-only">Area</span>
              <span>{area}</span>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {highlights.map((h) => (
              <span
                key={h}
                className="inline-flex items-center rounded-full border px-2 py-1 text-xs text-muted-foreground"
              >
                {h}
              </span>
            ))}
          </div>

          <Button asChild className="w-full">
            <Link href={`/${id || ''}`} aria-disabled={!id} className={!id ? "pointer-events-none opacity-50" : undefined}>
              Details
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
