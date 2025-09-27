"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { MapAndResults } from "@/components/map-and-results"
import { PropertyFilters } from "@/components/property-filters"
import { PropertyFilters as PropertyFiltersType } from "@/types/property"
import { parseUrlFilters } from "@/lib/search-handler"

export default function Page() {
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<PropertyFiltersType>({
    status: ["for_sale"],
    limit: 100
  })
  const [appliedFilters, setAppliedFilters] = useState<PropertyFiltersType>({
    status: ["for_sale"],
    limit: 100
  })
  const [searchLocation, setSearchLocation] = useState<{ location: string; radius: number } | undefined>()

  // Parse URL parameters on component mount
  useEffect(() => {
    if (searchParams.toString()) {
      const { filters: urlFilters, searchLocation: urlSearchLocation } = parseUrlFilters(searchParams)
      setFilters(urlFilters)
      setAppliedFilters(urlFilters)
      setSearchLocation(urlSearchLocation)
    }
  }, [searchParams])

  const handleFiltersChange = (newFilters: PropertyFiltersType) => {
    setFilters(newFilters)
  }

  const handleApplyFilters = () => {
    setAppliedFilters(filters)
  }

  const handleClearFilters = () => {
    const clearedFilters = {
      status: ["for_sale"],
      limit: 100
    }
    setFilters(clearedFilters)
    setAppliedFilters(clearedFilters)
  }

  return (
    <main className="h-screen flex flex-col md:flex-row">
      {/* Filters Sidebar */}
      <section className="w-full md:w-[35%] bg-background border-r overflow-y-auto">
        <div className="p-4">
          <PropertyFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
            onApplyFilters={handleApplyFilters}
          />
        </div>
      </section>

      {/* Map and Results */}
      <section className="w-full md:w-[65%] flex-1 bg-background">
        <MapAndResults filters={appliedFilters} searchLocation={searchLocation} />
      </section>
    </main>
  )
}
