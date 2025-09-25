"use client"

import { useState } from "react"
import { ChatSidebar } from "@/components/chat-sidebar"
import { MapAndResults } from "@/components/map-and-results"

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

  return (
    <main className="h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-[35%] bg-muted border-r">
        <ChatSidebar onPropertiesUpdate={setProperties} />
      </aside>

      <section className="w-full md:w-[65%] flex-1 bg-background">
        <MapAndResults properties={properties} />
      </section>
    </main>
  )
}
