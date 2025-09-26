"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { X, Filter, Search } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export type PropertyFilters = {
  // Price filters
  minPrice?: number
  maxPrice?: number
  
  // Property details
  minBeds?: number
  maxBeds?: number
  minBaths?: number
  maxBaths?: number
  minSqft?: number
  maxSqft?: number
  minYearBuilt?: number
  maxYearBuilt?: number
  
  // Property type and status
  propertyType?: string[]
  status?: string[]
  
  // Location filters
  city?: string
  state?: string
  zipCode?: string
  neighborhood?: string
  
  // Features and amenities
  hasGarage?: boolean
  hasPool?: boolean
  hasElevator?: boolean
  hasHOA?: boolean
  minHOA?: number
  maxHOA?: number
  
  // Special conditions
  isNewConstruction?: boolean
  isPending?: boolean
  isForeclosure?: boolean
  isPriceReduced?: boolean
  isNewListing?: boolean
  
  // Pet policy
  allowsCats?: boolean
  allowsDogs?: boolean
  
  // School filters
  minSchoolRating?: number
  schoolType?: string[]
  
  // Additional filters
  hasVirtualTour?: boolean
  hasMatterport?: boolean
  hasOpenHouse?: boolean
}

type PropertyFiltersProps = {
  filters: PropertyFilters
  onFiltersChange: (filters: PropertyFilters) => void
  onClearFilters: () => void
  onApplyFilters: () => void
}

const PROPERTY_TYPES = [
  "single_family",
  "condo",
  "townhouse",
  "coop",
  "multi_family",
  "land",
  "mobile",
  "farm",
  "other"
]

const STATUS_OPTIONS = [
  "for_sale",
  "for_rent",
  "sold",
  "off_market",
  "pending",
  "contingent"
]

const SCHOOL_TYPES = [
  "public",
  "private",
  "charter"
]

export function PropertyFilters({ filters, onFiltersChange, onClearFilters, onApplyFilters }: PropertyFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeFiltersCount, setActiveFiltersCount] = useState(0)

  // Count active filters
  const countActiveFilters = (filters: PropertyFilters) => {
    let count = 0
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        if (Array.isArray(value)) {
          if (value.length > 0) count++
        } else if (typeof value === "boolean") {
          if (value) count++
        } else if (typeof value === "number") {
          if (value > 0) count++
        } else {
          count++
        }
      }
    })
    return count
  }

  const updateFilter = (key: keyof PropertyFilters, value: any) => {
    const newFilters = { ...filters, [key]: value }
    onFiltersChange(newFilters)
    setActiveFiltersCount(countActiveFilters(newFilters))
  }

  const removeFilter = (key: keyof PropertyFilters) => {
    const newFilters = { ...filters, [key]: undefined }
    onFiltersChange(newFilters)
    setActiveFiltersCount(countActiveFilters(newFilters))
  }

  const handleClearAll = () => {
    onClearFilters()
    setActiveFiltersCount(0)
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={onApplyFilters} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Search className="h-4 w-4 mr-1" />
              Apply Filters
            </Button>
            {activeFiltersCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                Clear All
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? "Hide" : "Show"} Filters
            </Button>
          </div>
        </div>
      </CardHeader>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <CardContent className="space-y-6">
          {/* Price Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Price Range</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minPrice" className="text-xs text-muted-foreground">
                  Min Price
                </Label>
                <Input
                  id="minPrice"
                  type="number"
                  placeholder="0"
                  value={filters.minPrice || ""}
                  onChange={(e) => updateFilter("minPrice", e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div>
                <Label htmlFor="maxPrice" className="text-xs text-muted-foreground">
                  Max Price
                </Label>
                <Input
                  id="maxPrice"
                  type="number"
                  placeholder="No limit"
                  value={filters.maxPrice || ""}
                  onChange={(e) => updateFilter("maxPrice", e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Property Details</Label>
            
            {/* Beds and Baths */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Bedrooms</Label>
                <div className="flex gap-2">
                  <Select
                    value={filters.minBeds?.toString() || ""}
                    onValueChange={(value) => updateFilter("minBeds", value ? Number(value) : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}+
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.maxBeds?.toString() || ""}
                    onValueChange={(value) => updateFilter("maxBeds", value ? Number(value) : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Max" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Bathrooms</Label>
                <div className="flex gap-2">
                  <Select
                    value={filters.minBaths?.toString() || ""}
                    onValueChange={(value) => updateFilter("minBaths", value ? Number(value) : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}+
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.maxBaths?.toString() || ""}
                    onValueChange={(value) => updateFilter("maxBaths", value ? Number(value) : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Max" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Square Footage */}
            <div>
              <Label className="text-xs text-muted-foreground">Square Footage</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  placeholder="Min sqft"
                  value={filters.minSqft || ""}
                  onChange={(e) => updateFilter("minSqft", e.target.value ? Number(e.target.value) : undefined)}
                />
                <Input
                  type="number"
                  placeholder="Max sqft"
                  value={filters.maxSqft || ""}
                  onChange={(e) => updateFilter("maxSqft", e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            </div>

            {/* Year Built */}
            <div>
              <Label className="text-xs text-muted-foreground">Year Built</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  placeholder="Min year"
                  value={filters.minYearBuilt || ""}
                  onChange={(e) => updateFilter("minYearBuilt", e.target.value ? Number(e.target.value) : undefined)}
                />
                <Input
                  type="number"
                  placeholder="Max year"
                  value={filters.maxYearBuilt || ""}
                  onChange={(e) => updateFilter("maxYearBuilt", e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            </div>
          </div>

          {/* Property Type and Status */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Property Type</Label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={type}
                    checked={filters.propertyType?.includes(type) || false}
                    onCheckedChange={(checked) => {
                      const currentTypes = filters.propertyType || []
                      if (checked) {
                        updateFilter("propertyType", [...currentTypes, type])
                      } else {
                        updateFilter("propertyType", currentTypes.filter(t => t !== type))
                      }
                    }}
                  />
                  <Label htmlFor={type} className="text-xs capitalize">
                    {type.replace("_", " ")}
                  </Label>
                </div>
              ))}
            </div>

            <div>
              <Label className="text-sm font-medium">Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={status}
                      checked={filters.status?.includes(status) || false}
                      onCheckedChange={(checked) => {
                        const currentStatus = filters.status || []
                        if (checked) {
                          updateFilter("status", [...currentStatus, status])
                        } else {
                          updateFilter("status", currentStatus.filter(s => s !== status))
                        }
                      }}
                    />
                    <Label htmlFor={status} className="text-xs capitalize">
                      {status.replace("_", " ")}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Location</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city" className="text-xs text-muted-foreground">
                  City
                </Label>
                <Input
                  id="city"
                  placeholder="Enter city"
                  value={filters.city || ""}
                  onChange={(e) => updateFilter("city", e.target.value || undefined)}
                />
              </div>
              <div>
                <Label htmlFor="state" className="text-xs text-muted-foreground">
                  State
                </Label>
                <Input
                  id="state"
                  placeholder="Enter state"
                  value={filters.state || ""}
                  onChange={(e) => updateFilter("state", e.target.value || undefined)}
                />
              </div>
              <div>
                <Label htmlFor="zipCode" className="text-xs text-muted-foreground">
                  ZIP Code
                </Label>
                <Input
                  id="zipCode"
                  placeholder="Enter ZIP"
                  value={filters.zipCode || ""}
                  onChange={(e) => updateFilter("zipCode", e.target.value || undefined)}
                />
              </div>
              <div>
                <Label htmlFor="neighborhood" className="text-xs text-muted-foreground">
                  Neighborhood
                </Label>
                <Input
                  id="neighborhood"
                  placeholder="Enter neighborhood"
                  value={filters.neighborhood || ""}
                  onChange={(e) => updateFilter("neighborhood", e.target.value || undefined)}
                />
              </div>
            </div>
          </div>

          {/* Features and Amenities */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Features & Amenities</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasGarage"
                    checked={filters.hasGarage || false}
                    onCheckedChange={(checked) => updateFilter("hasGarage", checked)}
                  />
                  <Label htmlFor="hasGarage" className="text-xs">Garage</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasPool"
                    checked={filters.hasPool || false}
                    onCheckedChange={(checked) => updateFilter("hasPool", checked)}
                  />
                  <Label htmlFor="hasPool" className="text-xs">Pool</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasElevator"
                    checked={filters.hasElevator || false}
                    onCheckedChange={(checked) => updateFilter("hasElevator", checked)}
                  />
                  <Label htmlFor="hasElevator" className="text-xs">Elevator</Label>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasHOA"
                    checked={filters.hasHOA || false}
                    onCheckedChange={(checked) => updateFilter("hasHOA", checked)}
                  />
                  <Label htmlFor="hasHOA" className="text-xs">HOA</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasVirtualTour"
                    checked={filters.hasVirtualTour || false}
                    onCheckedChange={(checked) => updateFilter("hasVirtualTour", checked)}
                  />
                  <Label htmlFor="hasVirtualTour" className="text-xs">Virtual Tour</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasMatterport"
                    checked={filters.hasMatterport || false}
                    onCheckedChange={(checked) => updateFilter("hasMatterport", checked)}
                  />
                  <Label htmlFor="hasMatterport" className="text-xs">Matterport</Label>
                </div>
              </div>
            </div>

            {/* HOA Fee Range */}
            {(filters.hasHOA || filters.minHOA || filters.maxHOA) && (
              <div>
                <Label className="text-xs text-muted-foreground">HOA Fee Range</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="number"
                    placeholder="Min HOA"
                    value={filters.minHOA || ""}
                    onChange={(e) => updateFilter("minHOA", e.target.value ? Number(e.target.value) : undefined)}
                  />
                  <Input
                    type="number"
                    placeholder="Max HOA"
                    value={filters.maxHOA || ""}
                    onChange={(e) => updateFilter("maxHOA", e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Special Conditions */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Special Conditions</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isNewConstruction"
                    checked={filters.isNewConstruction || false}
                    onCheckedChange={(checked) => updateFilter("isNewConstruction", checked)}
                  />
                  <Label htmlFor="isNewConstruction" className="text-xs">New Construction</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPending"
                    checked={filters.isPending || false}
                    onCheckedChange={(checked) => updateFilter("isPending", checked)}
                  />
                  <Label htmlFor="isPending" className="text-xs">Pending</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isForeclosure"
                    checked={filters.isForeclosure || false}
                    onCheckedChange={(checked) => updateFilter("isForeclosure", checked)}
                  />
                  <Label htmlFor="isForeclosure" className="text-xs">Foreclosure</Label>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPriceReduced"
                    checked={filters.isPriceReduced || false}
                    onCheckedChange={(checked) => updateFilter("isPriceReduced", checked)}
                  />
                  <Label htmlFor="isPriceReduced" className="text-xs">Price Reduced</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isNewListing"
                    checked={filters.isNewListing || false}
                    onCheckedChange={(checked) => updateFilter("isNewListing", checked)}
                  />
                  <Label htmlFor="isNewListing" className="text-xs">New Listing</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasOpenHouse"
                    checked={filters.hasOpenHouse || false}
                    onCheckedChange={(checked) => updateFilter("hasOpenHouse", checked)}
                  />
                  <Label htmlFor="hasOpenHouse" className="text-xs">Open House</Label>
                </div>
              </div>
            </div>
          </div>

          {/* Pet Policy */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Pet Policy</Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowsCats"
                  checked={filters.allowsCats || false}
                  onCheckedChange={(checked) => updateFilter("allowsCats", checked)}
                />
                <Label htmlFor="allowsCats" className="text-xs">Cats Allowed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowsDogs"
                  checked={filters.allowsDogs || false}
                  onCheckedChange={(checked) => updateFilter("allowsDogs", checked)}
                />
                <Label htmlFor="allowsDogs" className="text-xs">Dogs Allowed</Label>
              </div>
            </div>
          </div>

          {/* School Filters */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Schools</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Minimum School Rating</Label>
                <Select
                  value={filters.minSchoolRating?.toString() || ""}
                  onValueChange={(value) => updateFilter("minSchoolRating", value ? Number(value) : undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any rating" />
                  </SelectTrigger>
                  <SelectContent>
                    {[6, 7, 8, 9, 10].map((rating) => (
                      <SelectItem key={rating} value={rating.toString()}>
                        {rating}+
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">School Type</Label>
                <div className="flex flex-wrap gap-2">
                  {SCHOOL_TYPES.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={type}
                        checked={filters.schoolType?.includes(type) || false}
                        onCheckedChange={(checked) => {
                          const currentTypes = filters.schoolType || []
                          if (checked) {
                            updateFilter("schoolType", [...currentTypes, type])
                          } else {
                            updateFilter("schoolType", currentTypes.filter(t => t !== type))
                          }
                        }}
                      />
                      <Label htmlFor={type} className="text-xs capitalize">
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
