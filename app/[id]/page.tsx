"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import ChatbotDialog from "@/components/chatbot-dialog"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"

type RealtorDetailsResponse = any

function currency(amount?: number | null): string {
  if (typeof amount !== "number") return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
}

export default function ListingPage() {
  const params = useParams() as { id?: string }
  const id = params?.id || ""
  const [data, setData] = useState<RealtorDetailsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState<boolean>(false)
  const [neighborhoodData, setNeighborhoodData] = useState<any>(null)

  useEffect(() => {
    let isActive = true
    async function load() {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/realtor/${encodeURIComponent(id)}`, { cache: "no-store" })
        if (!res.ok) {
          const txt = await res.text().catch(() => "")
          throw new Error(txt || `Request failed: ${res.status}`)
        }
        const json = await res.json()
        if (!isActive) return
        setData(json)
      } catch (e: any) {
        if (!isActive) return
        setError(e?.message || "Failed to load listing")
      } finally {
        if (isActive) setLoading(false)
      }
    }
    load()
    return () => {
      isActive = false
    }
  }, [id])

  const home = useMemo(() => {
    const h = (data as any)?.data?.home || (data as any)?.home || (data as any)?.data?.property || (data as any)?.property || null
    return h
  }, [data])

  const photos: { href: string }[] = (home?.photos && Array.isArray(home.photos) ? home.photos : []) as { href: string }[]
  const primaryPhoto = photos?.[0]?.href || (home?.primary_photo?.href as string | undefined) || "/placeholder.svg"
  const addressLine = home?.location?.address?.line || home?.address?.line || ""
  const city = home?.location?.address?.city || home?.address?.city
  const stateCode = home?.location?.address?.state_code || home?.address?.state_code
  const postalCode = home?.location?.address?.postal_code || home?.address?.postal_code
  const fullAddress = [addressLine, city, stateCode, postalCode].filter(Boolean).join(", ")
  const latitude = home?.location?.address?.coordinate?.lat ?? home?.location?.address?.coordinate?.latitude
  const longitude = home?.location?.address?.coordinate?.lon ?? home?.location?.address?.coordinate?.lng ?? home?.location?.address?.coordinate?.longitude
  const price = typeof home?.list_price === "number" ? home.list_price : undefined
  const beds = home?.description?.beds ?? home?.beds ?? null
  const baths = home?.description?.baths ?? home?.baths ?? null
  const hoaFee = home?.hoa?.fee ?? null
  const descriptionText = home?.description?.text as string | undefined
  const nearbySchools = (home?.nearby_schools?.schools || home?.schools?.schools || []) as Array<any>

  // Fetch neighborhood data when coordinates are available
  useEffect(() => {
    async function fetchNeighborhoodData() {
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        try {
          const response = await fetch('/api/neighborhood', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude }),
          })
          if (response.ok) {
            const data = await response.json()
            setNeighborhoodData(data)
          }
        } catch (error) {
          console.error('Failed to fetch neighborhood data:', error)
        }
      }
    }
    
    if (home) {
      fetchNeighborhoodData()
    }
  }, [home, latitude, longitude])

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0)
  const totalPhotos = Array.isArray(photos) ? photos.length : 0
  const displayedPhoto = totalPhotos > 0 ? (photos[currentPhotoIndex]?.href || primaryPhoto) : primaryPhoto

  useEffect(() => {
    // Reset to first photo when listing changes
    setCurrentPhotoIndex(0)
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-xl border bg-muted/40" />
          <div className="flex flex-col gap-4">
            <div className="h-8 w-48 animate-pulse rounded-md bg-muted/60" />
            <div className="h-4 w-80 animate-pulse rounded-md bg-muted/40" />
            <div className="mt-2 flex gap-3">
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted/40" />
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted/40" />
              <div className="h-8 w-28 animate-pulse rounded-md bg-muted/40" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="mb-2 text-2xl font-semibold">Couldn’t load listing</div>
        <div className="text-muted-foreground">{error}</div>
        {data ? (
          <div className="mx-auto mt-6 w-full max-w-3xl overflow-auto rounded-lg border bg-muted/10 p-4 text-left">
            <div className="mb-2 font-medium">API response (debug)</div>
            <pre className="max-h-96 overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
          </div>
        ) : null}
      </div>
    )
  }

  // If no normalized `home` object is present, still show the API payload for visibility
  if (!home && data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 text-2xl font-semibold">Listing {id}</div>
        <div className="rounded-lg border bg-muted/10 p-4">
          <div className="mb-2 font-medium">API response (debug)</div>
          <pre className="max-h-[70vh] overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted/20">
          <img src={displayedPhoto} alt={fullAddress || `Listing ${id}`} className="h-full w-full object-cover" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
            <div className="pointer-events-auto" />
            <div className="pointer-events-auto flex items-center gap-2">
              {totalPhotos > 1 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="backdrop-blur supports-[backdrop-filter]:bg-background/70"
                  onClick={() => setCurrentPhotoIndex((i) => (i + 1) % totalPhotos)}
                  aria-label="Next photo"
                >
                  Next
                </Button>
              ) : null}
            </div>
          </div>
          {totalPhotos > 0 ? (
            <div className="absolute left-3 top-3 rounded-full border bg-background/70 px-2 py-0.5 text-xs text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/70">
              {currentPhotoIndex + 1} / {totalPhotos}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="text-3xl font-semibold">{currency(price)}</div>
            <div className="text-muted-foreground">{fullAddress || id}</div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="rounded-lg border px-3 py-2">
              <span className="font-medium">Beds:</span> {beds ?? "—"}
            </div>
            <div className="rounded-lg border px-3 py-2">
              <span className="font-medium">Baths:</span> {baths ?? "—"}
            </div>
            <div className="rounded-lg border px-3 py-2">
              <span className="font-medium">HOA:</span> {hoaFee != null ? currency(hoaFee) : "—"}
            </div>
            <div className="rounded-lg border px-3 py-2">
              <span className="font-medium">Status:</span> {home?.status || "—"}
            </div>
          </div>

          {descriptionText ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-line leading-relaxed">{descriptionText}</p>
            </div>
          ) : null}

          <div className="mt-2">
            <Button onClick={() => setChatOpen(true)}>Ask AI</Button>
          </div>
        </div>
      </div>

      {Array.isArray(nearbySchools) && nearbySchools.length > 0 ? (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">Nearby schools</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {nearbySchools.slice(0, 6).map((s, idx) => (
              <div key={`${s?.id || idx}`} className="rounded-lg border p-4">
                <div className="font-medium">{s?.name || "School"}</div>
                <div className="text-sm text-muted-foreground">
                  {(s?.education_levels || []).join(", ")}
                  {typeof s?.rating === "number" ? ` • Rating ${s.rating}` : ""}
                  {typeof s?.distance_in_miles === "number" ? ` • ${s.distance_in_miles} mi` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Debug panel to always allow inspecting upstream payload */}
      {data ? (
        <div className="mt-10">
          <details className="rounded-lg border bg-muted/10 p-4">
            <summary className="cursor-pointer select-none font-medium">API response (debug)</summary>
            <pre className="mt-3 max-h-[60vh] overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
          </details>
        </div>
      ) : null}

      <ChatbotDialog
        open={chatOpen}
        onOpenChange={setChatOpen}
        title="Ask AI"
        description="Ask questions about this listing or neighborhood."
        initialPrompt={fullAddress ? `` : undefined}
        projectId={id}
        projectContext={{
          id,
          address: fullAddress,
          price,
          beds,
          baths,
          hoaFee,
          status: home?.status,
          latitude: typeof latitude === 'number' ? latitude : undefined,
          longitude: typeof longitude === 'number' ? longitude : undefined,
          neighborhood: neighborhoodData,
        }}
      />
    </div>
  )
}


