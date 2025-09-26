export interface Property {
  property_id: string
  last_update_date: string
  last_price_change_date?: string | null
  last_price_change_amount?: number | null
  listing_id: string
  status: string
  href: string
  list_date: string
  mortgage?: {
    is_listing_price_eligible_for_fha: boolean
    is_dpa_eligible: boolean
    county_fha_loan_limit: number
    property_tax_rate?: number | null
    rates_url: string
    estimate: {
      loan_amount: number
      monthly_payment: number
      total_payment: number
      down_payment: number
      average_rate: {
        rate: number
        loan_type: {
          term: number
        }
      }
      monthly_payment_details: Array<{
        type: string
        amount: number
        display_name: string
      }>
    }
    average_rates: Array<{
      loan_type: {
        loan_id: string
      }
      rate: number
    }>
  }
  hoa?: {
    fee: number
  }
  buyers?: any
  description: {
    baths_consolidated: string
    baths: number
    baths_min?: number | null
    baths_max?: number | null
    heating?: string | null
    cooling?: string | null
    beds: number
    beds_min?: number | null
    beds_max?: number | null
    garage?: string | null
    garage_min?: number | null
    garage_max?: number | null
    pool?: string | null
    sqft?: number | null
    sqft_min?: number | null
    sqft_max?: number | null
    styles?: string | null
    lot_sqft?: number | null
    units?: number | null
    stories?: number | null
    type: string
    text: string
    year_built: number
    name?: string | null
  }
  pet_policy?: any
  nearby_schools?: {
    schools: School[]
  }
  schools?: {
    schools: School[]
  }
  products: {
    products: string[]
  }
  list_price: number
  list_price_min?: number | null
  list_price_max?: number | null
  price_per_sqft?: number | null
  community?: any
  lead_attributes: {
    opcity_lead_attributes: {
      flip_the_market_enabled: boolean
      cashback_enabled: boolean
      phones?: any
    }
    ready_connect_mortgage: {
      show_contact_a_lender: boolean
      show_veterans_united: boolean
    }
    lead_type: string
    show_lead_form: boolean
    disclaimer_text?: string | null
    is_tcpa_message_enabled?: boolean | null
    show_text_leads: boolean
    is_premium_ldp?: boolean | null
    is_schedule_a_tour: boolean
  }
  flags: {
    is_contingent?: boolean | null
    is_new_construction?: boolean | null
    is_pending?: boolean | null
    is_foreclosure?: boolean | null
    is_deal_available?: boolean | null
    is_subdivision?: boolean | null
    is_plan?: boolean | null
    is_price_reduced?: boolean | null
    is_new_listing?: boolean | null
    is_coming_soon?: boolean | null
    is_usda_eligible?: boolean | null
  }
  provider_url: {
    href: string
  }
  source: {
    id: string
    disclaimer?: string | null
    listing_id: string
    plan_id?: string | null
    spec_id?: string | null
    community_id?: string | null
    name: string
    type: string
    feed_type?: string | null
    agents: Array<{
      agent_name: string
    }>
  }
  details: Array<{
    category: string
    text: string[]
  }>
  open_houses?: any
  tax_history?: any
  location: {
    address: {
      line: string
      city: string
      state_code: string
      postal_code: string
      state: string
      coordinate: {
        lat: number
        lon: number
      }
    }
    county: {
      fips_code: string
      name: string
      state_code: string
    }
    street_view_url: string
    neighborhoods: Array<{
      name: string
      geo_statistics: {
        housing_market: {
          median_price_per_sqft: number
          median_sold_price: number
          median_listing_price: number
          median_days_on_market: number
        }
      }
    }>
  }
  branding: Array<{
    type: string
    photo?: string | null
    name: string
    phone?: string | null
    slogan?: string | null
    accent_color?: string | null
  }>
  consumer_advertisers: Array<{
    advertiser_id: string
    office_id: string
    agent_id: string
    name: string
    phone?: string | null
    type: string
    href: string
    photo: {
      href?: string | null
    }
    show_realtor_logo: boolean
    hours?: any
  }>
  specials?: any
  advertisers: Array<{
    fulfillment_id: string
    nrds_id?: string | null
    name: string
    type: string
    email: string
    href: string
    state_license: string
    phones: Array<{
      number: string
      type: string
      ext: string
      trackable?: any
      primary: boolean
    }>
    builder?: any
    office: {
      fulfillment_id: string
      name: string
      href: string
      photo: {
        href: string
      }
      email: string
      phones: Array<{
        number: string
        type: string
        ext: string
        trackable?: any
        primary: boolean
      }>
      address: {
        city: string
        state_code: string
      }
    }
    broker: {
      fulfillment_id: string
      name: string
    }
    photo: {
      href: string
    }
    rental_management?: any
  }>
  photo_count: number
  photos: Array<{
    href: string
    type: string
    tags: Array<{
      label: string
      probability: number
    }>
  }>
  property_history: Array<{
    date: string
    event_name: string
    price: number
    source_name: string
    listing: {
      photos: Array<{
        href: string
        type: string
        tags: Array<{
          label: string
          probability: number
        }>
      }>
      description: {
        sqft?: number | null
      }
    }
  }>
  local?: {
    noise?: {
      score: number
      noise_categories: Array<{
        type: string
        text: string
      }>
    }
    flood?: {
      fsid: string
      flood_factor_score: number
      flood_trend_paragraph: string
      firststreet_url: string
      fema_zone: string[]
      flood_insurance_text: string
      insurance_rates: Array<{
        provider_url: string
      }>
    }
  }
  last_sold_price?: number | null
  last_sold_date?: string | null
  estimates?: {
    current_values?: any
    historical_values?: any
    forecast_values?: any
  }
  virtual_tours?: any
  home_tours: {
    virtual_tours: any[]
  }
  matterport?: any
  terms?: any
  monthly_fees?: any
  one_time_fees?: any
  units?: any
  community_rental_floorplans?: any
}

export interface School {
  __typename: string
  coordinate: {
    lat: number
    lon: number
  }
  distance_in_miles: number
  district: {
    id: string
    name: string | null
  }
  education_levels: string[]
  funding_type: string
  grades: string[]
  id: string
  name: string
  rating?: number | null
  student_count: number
}

export interface PropertyFilters {
  // API pagination
  limit?: number
  offset?: number
  
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

export interface PropertyCardData {
  id?: string
  imageUrl: string
  price: string
  address: string
  beds: string
  area: string
  highlights: string[]
}
