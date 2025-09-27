"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SearchDemo() {
  const [location, setLocation] = useState("3418 26th St Apt 1, San Francisco, CA, 94110")
  const [radius, setRadius] = useState(5)
  const [priceMax, setPriceMax] = useState("")
  const [bedsMin, setBedsMin] = useState("0")
  const [hoaMax, setHoaMax] = useState("")

  const handleSearch = () => {
    const params = new URLSearchParams()
    params.set('location', location)
    params.set('radius', radius.toString())
    if (priceMax) params.set('price_max', priceMax)
    if (bedsMin) params.set('beds_min', bedsMin)
    if (hoaMax) params.set('hoa_max', hoaMax)
    
    window.location.href = `/?${params.toString()}`
  }

  const handleExampleSearch = (example: string) => {
    switch (example) {
      case 'basic':
        setLocation("3418 26th St Apt 1, San Francisco, CA, 94110")
        setRadius(5)
        setPriceMax("")
        setBedsMin("0")
        setHoaMax("")
        break
      case 'price':
        setLocation("3418 26th St Apt 1, San Francisco, CA, 94110")
        setRadius(5)
        setPriceMax("800000")
        setBedsMin("2")
        setHoaMax("")
        break
      case 'hoa':
        setLocation("3418 26th St Apt 1, San Francisco, CA, 94110")
        setRadius(5)
        setPriceMax("")
        setBedsMin("0")
        setHoaMax("200")
        break
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Property Search Demo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test location-based property searches with various filters
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter address or location"
              />
            </div>
            
            <div>
              <Label htmlFor="radius">Radius (miles)</Label>
              <Input
                id="radius"
                type="number"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                min="1"
                max="100"
              />
            </div>
            
            <div>
              <Label htmlFor="priceMax">Max Price (optional)</Label>
              <Input
                id="priceMax"
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="e.g., 800000"
              />
            </div>
            
            <div>
              <Label htmlFor="bedsMin">Min Bedrooms</Label>
              <Input
                id="bedsMin"
                type="number"
                value={bedsMin}
                onChange={(e) => setBedsMin(e.target.value)}
                min="0"
              />
            </div>
            
            <div>
              <Label htmlFor="hoaMax">Max HOA Fee (optional)</Label>
              <Input
                id="hoaMax"
                type="number"
                value={hoaMax}
                onChange={(e) => setHoaMax(e.target.value)}
                placeholder="e.g., 200"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Button onClick={handleSearch} className="w-full">
              Search Properties
            </Button>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Example Searches:</p>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExampleSearch('basic')}
                >
                  Basic Search
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExampleSearch('price')}
                >
                  Max $800k, 2+ beds
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExampleSearch('hoa')}
                >
                  Max $200 HOA
                </Button>
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Enter a location and radius to search for properties nearby</li>
              <li>Add optional filters like max price, min bedrooms, or max HOA fees</li>
              <li>Click "Search Properties" to redirect to the main page with filters applied</li>
              <li>The search will find properties within the specified radius of the location</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
