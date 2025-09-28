import { NextRequest, NextResponse } from 'next/server'
import { CHAT_SYSTEM_PROMPT, NEGOTIATION_AGENT_PROMPT, NEGOTIATION_AGENT_PROMPT_COMPACT } from './prompt'

const SENSAY_BASE_URL = 'https://api.sensay.io/v1'

// Utilities to compact context and cap payload sizes
function truncateString(s: string, max = 20000) {
  if (typeof s !== 'string') return s as any
  return s.length > max ? s.slice(0, max) : s
}

function safeJSONStringify(obj: any, max = 20000) {
  try {
    const s = JSON.stringify(obj)
    return truncateString(s, max)
  } catch {
    return ''
  }
}

function compactRealtorDetails(rd: any) {
  if (!rd) return null
  const home = rd?.data?.home || rd?.home || rd
  const loc = home?.location?.address || home?.address || {}
  const desc = home?.description || {}
  const bs = home?.building_size || {}
  const hoa = home?.hoa || {}
  const price_history = Array.isArray(home?.price_history) ? home.price_history.slice(0, 5) : undefined
  // Drop photos entirely to minimize payload and avoid provider validation on URLs
  const photos = undefined

  return {
    list_price: home?.list_price,
    status: home?.status,
    days_on_market: home?.days_on_market,
    description: { 
      beds: desc?.beds, 
      baths: desc?.baths, 
      type: desc?.type,
      text: desc?.text // Include property description text
    },
    building_size: { size: bs?.size },
    year_built: home?.year_built,
    hoa: { fee: hoa?.fee },
    location: {
      address: {
        line: loc?.line,
        city: loc?.city,
        state_code: loc?.state_code,
        postal_code: loc?.postal_code,
        coordinate: home?.location?.address?.coordinate || undefined,
      },
    },
    price_history,
    photos,
  }
}

function compactNeighborhood(nb: any) {
  if (!nb) return null
  return {
    area: nb?.area || nb?.name,
    walkability_score: nb?.walkability_score,
    crime_rate: nb?.crime_rate,
    market_trends: Array.isArray(nb?.market_trends) ? nb.market_trends.slice(0, 3) : undefined,
    schools: Array.isArray(nb?.schools) ? nb.schools.slice(0, 3) : undefined,
  }
}

// Simple in-memory caches (per server instance)
const replicaCache = new Map<string, string>() // userId -> replicaUuid
const projectCache = new Map<string, { realtorDetails?: any; neighborhood?: any; ts: number }>() // projectId -> ctx

// Function to generate proactive analysis
async function generateProactiveAnalysis(context: any): Promise<string> {
  const rd = context?.realtorDetails
  const nb = context?.neighborhood
  const pc = context?.projectContext
  
  // Extract property data
  const address = rd?.location?.address?.line || pc?.address || 'This property'
  const city = rd?.location?.address?.city || pc?.address?.split(',')[1]?.trim() || ''
  const state = rd?.location?.address?.state_code || pc?.address?.split(',')[2]?.trim() || ''
  const listPrice = rd?.list_price || pc?.price
  const beds = rd?.description?.beds || pc?.beds
  const baths = rd?.description?.baths || pc?.baths
  const sqft = rd?.building_size?.size
  const hoaFee = rd?.hoa?.fee || pc?.hoaFee
  const status = rd?.status || pc?.status
  const dom = rd?.days_on_market
  const yearBuilt = rd?.year_built
  const propertyType = rd?.description?.type || pc?.propertyType
  const latitude = rd?.location?.address?.coordinate?.lat || pc?.latitude
  const longitude = rd?.location?.address?.coordinate?.lng || pc?.longitude
  
  // Debug logging
  console.log('Property data extracted:', {
    address,
    listPrice,
    beds,
    baths,
    sqft,
    hoaFee,
    propertyType,
    yearBuilt,
    latitude,
    longitude
  });
  
  // Calculate key metrics
  const ppsf = listPrice && sqft ? Math.round(listPrice / sqft) : null
  const totalMonthlyCost = listPrice ? Math.round((listPrice * 0.08 / 12) + (hoaFee || 0)) : null
  const propertyAge = yearBuilt ? new Date().getFullYear() - yearBuilt : null
  
  // Generate market comparison insights
  const marketInsights = []
  if (ppsf) {
    const marketPosition = ppsf < 400 ? 'below market average' : 
                          ppsf < 600 ? 'at market average' : 
                          'above market average'
    marketInsights.push(`Priced ${marketPosition} for ${city || 'the area'}`)
  }
  
  if (dom !== undefined) {
    const marketPace = dom < 15 ? 'fast-moving market' : 
                      dom < 45 ? 'normal market pace' : 
                      'slow market with negotiation potential'
    marketInsights.push(`Currently in a ${marketPace}`)
  }
  
  // Generate lifestyle analysis from existing neighborhood data
  const lifestyleInsights = []
  if (nb?.walkability_score) {
    const walkability = nb.walkability_score > 90 ? 'excellent' : 
                       nb.walkability_score > 70 ? 'very good' : 
                       nb.walkability_score > 50 ? 'good' : 'limited'
    lifestyleInsights.push(`Walk Score: ${nb.walkability_score} (${walkability} walkability)`)
  }
  
  if (nb?.cafes?.length > 0) {
    lifestyleInsights.push(`${nb.cafes.length} cafes within walking distance`)
  }
  if (nb?.parks?.length > 0) {
    lifestyleInsights.push(`${nb.parks.length} parks nearby for outdoor activities`)
  }
  if (nb?.schools?.length > 0) {
    lifestyleInsights.push(`${nb.schools.length} schools in the area`)
  }
  
  // Fetch rental analysis from yield API
  let rentalInsights = []
  let neighborhoodInsights = []
  
  try {
    // Use 0 as default HOA fee if not provided
    const hoaFeeValue = hoaFee !== undefined ? hoaFee : 0;
    
    if (listPrice && (address || (latitude && longitude))) {
      console.log('Calling yield API with:', {
        address,
        latitude,
        longitude,
        propertyPrice: listPrice,
        hoaFees: hoaFeeValue,
        beds,
        baths,
        sqft,
        propertyType,
        yearBuilt
      });
      
      const yieldResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/yield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address,
          latitude: latitude,
          longitude: longitude,
          propertyPrice: listPrice,
          hoaFees: hoaFeeValue,
          beds: beds,
          baths: baths,
          sqft: sqft,
          propertyType: propertyType,
          yearBuilt: yearBuilt,
          propertyDescription: rd?.description?.text
        })
      })
      
      console.log('Yield API response status:', yieldResponse.status);
      
      if (yieldResponse.ok) {
        const yieldData = await yieldResponse.json()
        console.log('Yield API response data:', yieldData);
        rentalInsights.push(`Estimated monthly rent: $${yieldData.estimatedMonthlyRent?.toLocaleString() || 'N/A'}`)
        rentalInsights.push(`Annual rental income: $${yieldData.annualRentalIncome?.toLocaleString() || 'N/A'}`)
        rentalInsights.push(`Cap rate: ${yieldData.capRate?.toFixed(2) || 'N/A'}%`)
        rentalInsights.push(`Net operating income: $${yieldData.netOperatingIncome?.toLocaleString() || 'N/A'}/year`)
        console.log('Rental insights generated:', rentalInsights);
      } else {
        const errorText = await yieldResponse.text();
        console.log('Yield API error response:', errorText);
        console.log('Yield API error status:', yieldResponse.status);
      }
    } else {
      console.log('Skipping yield API call - missing required data:', {
        listPrice,
        address,
        latitude,
        longitude
      });
    }
  } catch (error) {
    console.log('Error fetching yield data:', error)
  }
  
  // Fetch neighborhood reviews
  try {
    if (address || (latitude && longitude)) {
      const reviewsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: address,
          latitude: latitude,
          longitude: longitude,
          radius: 3
        })
      })
      
      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json()
        if (reviewsData.summary) {
          neighborhoodInsights.push(`Community feedback: ${reviewsData.summary}`)
          if (reviewsData.averageRating) {
            neighborhoodInsights.push(`Average local rating: ${reviewsData.averageRating}/5`)
          }
          if (reviewsData.reviewCount) {
            neighborhoodInsights.push(`Based on ${reviewsData.reviewCount} reviews from ${reviewsData.placesReviewed || 1} local establishments`)
          }
        }
      }
    }
  } catch (error) {
    console.log('Error fetching reviews data:', error)
  }
  
  // Build the comprehensive analysis
  const analysis = `Hi! I've analyzed ${address}${city ? ` in ${city}` : ''}. Here's my comprehensive assessment:

⚖️ **Price Analysis**
   • Listed at ${listPrice ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(listPrice) : 'Price not available'}
   ${ppsf ? `• Price per sqft: $${ppsf}` : ''}
   ${totalMonthlyCost ? `• Estimated monthly cost: $${totalMonthlyCost.toLocaleString()}` : ''}
   ${marketInsights.length > 0 ? `• ${marketInsights.join(', ')}` : ''}

🚶‍♂️ **Lifestyle Match**
   ${lifestyleInsights.length > 0 ? lifestyleInsights.map(insight => `   • ${insight}`).join('\n') : '   • Neighborhood data not available'}

🏠 **Property Features**
   ${beds ? `   • ${beds} bedroom${beds !== 1 ? 's' : ''}` : ''}
   ${baths ? `   • ${baths} bathroom${baths !== 1 ? 's' : ''}` : ''}
   ${sqft ? `   • ${sqft.toLocaleString()} sqft` : ''}
   ${hoaFee ? `   • HOA: $${hoaFee}/month` : ''}
   ${propertyAge ? `   • Built in ${yearBuilt} (${propertyAge} years old)` : ''}
   ${propertyType ? `   • Property type: ${propertyType}` : ''}

📊 **Market Position**
   ${status ? `   • Status: ${status}` : ''}
   ${dom !== undefined ? `   • Days on market: ${dom}` : ''}
   ${dom !== undefined ? `   • ${dom < 15 ? 'Hot market - act fast!' : dom < 45 ? 'Normal market pace' : 'Slow market - negotiation opportunity'}` : ''}

💰 **Rental Potential**
   ${rentalInsights.length > 0 ? rentalInsights.map(insight => `   • ${insight}`).join('\n') : '   • Rental analysis not available'}

🏘️ **Neighborhood Insights**
   ${neighborhoodInsights.length > 0 ? neighborhoodInsights.map(insight => `   • ${insight}`).join('\n') : '   • Neighborhood reviews not available'}

What would you like to explore in more detail? I can help with:
• Detailed market comparison and pricing analysis
• Neighborhood reviews and local insights  
• Investment calculations and rental yield
• Negotiation strategy and offer recommendations
• Commute analysis and lifestyle scenarios`
  
  return analysis
}

// Function to calculate investment score
function calculateInvestmentScore(context: any): { score: number; reasoning: string[] } {
  const rd = context?.realtorDetails
  const nb = context?.neighborhood
  const pc = context?.projectContext
  
  // Extract property data
  const listPrice = rd?.list_price || pc?.price
  const beds = rd?.description?.beds || pc?.beds
  const baths = rd?.description?.baths || pc?.baths
  const sqft = rd?.building_size?.size
  const hoaFee = rd?.hoa?.fee || pc?.hoaFee
  const dom = rd?.days_on_market
  const yearBuilt = rd?.year_built
  const propertyType = rd?.description?.type || pc?.propertyType
  const propertyDescription = rd?.description?.text || ''
  
  // Calculate key metrics
  const ppsf = listPrice && sqft ? Math.round(listPrice / sqft) : null
  const propertyAge = yearBuilt ? new Date().getFullYear() - yearBuilt : null
  
  // Generate sophisticated investment score
  let investmentScore = 5
  let reasoning = []
  
  // Analyze property description for key factors
  const descLower = propertyDescription.toLowerCase()
  const hasDevelopmentPotential = descLower.includes('development opportunity') || descLower.includes('entitled') || descLower.includes('fully approved')
  const hasMultipleUnits = descLower.includes('2 unit building') || descLower.includes('multiple units') || descLower.includes('duplex')
  const hasOutdoorSpace = descLower.includes('outdoor spaces') || descLower.includes('patio') || descLower.includes('balcony')
  const hasGoodCondition = descLower.includes('good condition') || descLower.includes('livable') || descLower.includes('move-in ready')
  const hasUniqueFeatures = descLower.includes('oversized lot') || descLower.includes('natural light') || descLower.includes('flexible floor plan')
  const hasLocationAdvantage = descLower.includes('coveted') || descLower.includes('prime') || descLower.includes('walking distance')
  const needsRenovation = descLower.includes('needs renovation') || descLower.includes('fixer') || descLower.includes('tear down')
  
  // Price competitiveness (40% weight)
  if (ppsf) {
    if (ppsf < 300) {
      investmentScore += 2
      reasoning.push("Excellent price per sqft")
    } else if (ppsf < 500) {
      investmentScore += 1
      reasoning.push("Competitive pricing")
    } else if (ppsf > 800) {
      investmentScore -= 1
      reasoning.push("Premium pricing")
    }
  }
  
  // Market timing (25% weight)
    if (dom !== undefined) {
    if (dom < 15) {
      investmentScore += 1
      reasoning.push("Hot market - high demand")
    } else if (dom > 60) {
      investmentScore -= 1
      reasoning.push("Slow market - negotiation opportunity")
    }
  }
  
  // Property fundamentals (20% weight)
  if (beds && beds >= 3) {
    investmentScore += 1
    reasoning.push("Family-friendly layout")
  } else if (beds && beds === 1) {
    investmentScore -= 1
    reasoning.push("Single bedroom limits rental appeal")
  }
  if (propertyAge && propertyAge < 10) {
    investmentScore += 1
    reasoning.push("Modern construction")
  } else if (propertyAge && propertyAge > 30) {
    investmentScore -= 1
    reasoning.push("Older property - consider maintenance")
  }
  
  // Property description factors (15% weight)
  if (hasDevelopmentPotential) {
    investmentScore += 2
    reasoning.push("Strong development potential with entitled permits")
  }
  if (hasMultipleUnits) {
    investmentScore += 1.5
    reasoning.push("Multiple unit configuration increases rental income potential")
  }
  if (hasOutdoorSpace) {
    investmentScore += 1
    reasoning.push("Outdoor spaces add rental value")
  }
  if (hasGoodCondition) {
    investmentScore += 1
    reasoning.push("Good condition reduces immediate maintenance costs")
  }
  if (hasUniqueFeatures) {
    investmentScore += 0.5
    reasoning.push("Unique features enhance market appeal")
  }
  if (hasLocationAdvantage) {
    investmentScore += 1
    reasoning.push("Prime location with walking distance amenities")
  }
  if (needsRenovation) {
    investmentScore -= 1.5
    reasoning.push("Requires significant renovation investment")
  }
  
  // Location premium (15% weight)
  if (nb?.walkability_score && nb.walkability_score > 80) {
    investmentScore += 1
    reasoning.push("Excellent walkability")
  }
  if (nb?.schools?.length > 0) {
    investmentScore += 0.5
    reasoning.push("Good school district")
  }
  
  // HOA impact
  if (hoaFee) {
    if (hoaFee < 200) {
      investmentScore += 0.5
      reasoning.push("Low HOA fees")
    } else if (hoaFee > 500) {
      investmentScore -= 1
      reasoning.push("High HOA fees")
    }
  }
  
  // Cap investment score between 1-10
  investmentScore = Math.max(1, Math.min(10, Math.round(investmentScore)))
  
  return { score: investmentScore, reasoning }
}

// Function to detect if the message is about property negotiation
function isNegotiationQuery(message: string, hasProjectId: boolean): boolean {
  if (!hasProjectId) return false
  
  const negotiationKeywords = [
    'negotiate', 'negotiation', 'offer', 'bargain', 'deal', 'price', 'pricing',
    'overpriced', 'underpriced', 'fair price', 'market value', 'worth', 'value',
    'should i buy', 'buying advice', 'purchase', 'bid', 'counter offer',
    'inspection', 'contingency', 'closing', 'financing', 'mortgage',
    'comparable', 'comps', 'market analysis', 'price analysis', 'valuation',
    'seller', 'motivation', 'leverage', 'strategy', 'tactics', 'advice'
  ]
  
  const lowerMessage = message.toLowerCase()
  return negotiationKeywords.some(keyword => lowerMessage.includes(keyword))
}

function isYieldQuery(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('rental yield') || 
         lower.includes('cap rate') || 
         lower.includes('roi') || 
         lower.includes('return on investment') ||
         lower.includes('investment potential') ||
         lower.includes('rental income') ||
         lower.includes('cash flow') ||
         lower.includes('rental analysis') ||
         lower.includes('investment analysis') ||
         lower.includes('what can i rent') ||
         lower.includes('how much rent') ||
         lower.includes('rental potential') ||
         lower.includes('is this a good investment') ||
         lower.includes('investment returns') ||
         lower.includes('yield analysis') ||
         lower.includes('calculate rental') ||
         lower.includes('rental calculator') ||
         lower.includes('investment calculator') ||
         lower.includes('rental yield for') ||
         lower.includes('cap rate for') ||
         lower.includes('investment potential for') ||
         lower.includes('what\'s the rental yield') ||
         lower.includes('calculate cap rate') ||
         lower.includes('rental income potential') ||
         lower.includes('rental status') ||
         lower.includes('rent status') ||
         lower.includes('rental value') ||
         lower.includes('rent value') ||
         lower.includes('rental worth') ||
         lower.includes('rent worth') ||
         lower.includes('rental market') ||
         lower.includes('rent market') ||
         lower.includes('rental price') ||
         lower.includes('rent price') ||
         lower.includes('rental rate') ||
         lower.includes('rent rate') ||
         lower.includes('rental cost') ||
         lower.includes('rent cost') ||
         lower.includes('rental revenue') ||
         lower.includes('rent revenue') ||
         lower.includes('rental profit') ||
         lower.includes('rent profit') ||
         lower.includes('rental return') ||
         lower.includes('rent return') ||
         lower.includes('rental earnings') ||
         lower.includes('rent earnings') ||
         lower.includes('rental income potential') ||
         lower.includes('rental income analysis') ||
         lower.includes('rental income calculation') ||
         lower.includes('rental income estimate') ||
         lower.includes('rental income projection') ||
         lower.includes('rental income forecast') ||
         lower.includes('rental income prediction') ||
         lower.includes('rental income assessment') ||
         lower.includes('rental income evaluation') ||
         lower.includes('rental income appraisal') ||
         lower.includes('rental income valuation') ||
         lower.includes('rental income worth') ||
         lower.includes('rental income value') ||
         lower.includes('rental income market') ||
         lower.includes('rental income price') ||
         lower.includes('rental income rate') ||
         lower.includes('rental income cost') ||
         lower.includes('rental income revenue') ||
         lower.includes('rental income profit') ||
         lower.includes('rental income return') ||
         lower.includes('rental income earnings') ||
         // Spanish patterns
         lower.includes('estado del alquiler') ||
         lower.includes('estado de alquiler') ||
         lower.includes('estado del arrendamiento') ||
         lower.includes('estado de arrendamiento') ||
         lower.includes('rentabilidad') ||
         lower.includes('rendimiento') ||
         lower.includes('renta') ||
         lower.includes('alquiler') ||
         lower.includes('arrendamiento') ||
         lower.includes('ingresos por alquiler') ||
         lower.includes('ingresos por arrendamiento') ||
         lower.includes('renta mensual') ||
         lower.includes('alquiler mensual') ||
         lower.includes('arrendamiento mensual') ||
         lower.includes('precio de alquiler') ||
         lower.includes('precio de arrendamiento') ||
         lower.includes('valor de alquiler') ||
         lower.includes('valor de arrendamiento') ||
         lower.includes('mercado de alquiler') ||
         lower.includes('mercado de arrendamiento') ||
         lower.includes('análisis de alquiler') ||
         lower.includes('análisis de arrendamiento') ||
         lower.includes('potencial de alquiler') ||
         lower.includes('potencial de arrendamiento') ||
         lower.includes('cuánto puedo alquilar') ||
         lower.includes('cuánto puedo arrendar') ||
         lower.includes('cuánto se puede alquilar') ||
         lower.includes('cuánto se puede arrendar') ||
         lower.includes('cuál es el alquiler') ||
         lower.includes('cuál es el arrendamiento') ||
         lower.includes('cuál es la renta') ||
         lower.includes('cuál es el rendimiento') ||
         lower.includes('cuál es la rentabilidad') ||
         lower.includes('cuál es el estado del alquiler') ||
         lower.includes('cuál es el estado de alquiler') ||
         lower.includes('cuál es el estado del arrendamiento') ||
         lower.includes('cuál es el estado de arrendamiento')
}

function isLocalityReviewQuery(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('what do people say') ||
         lower.includes('reviews about') ||
         lower.includes('living here') ||
         lower.includes('neighborhood reviews') ||
         lower.includes('area reviews') ||
         lower.includes('local reviews') ||
         lower.includes('community reviews') ||
         lower.includes('residents say') ||
         lower.includes('people think') ||
         lower.includes('neighborhood feedback') ||
         lower.includes('area feedback') ||
         lower.includes('local feedback') ||
         lower.includes('community feedback') ||
         lower.includes('what\'s it like living') ||
         lower.includes('how is it living') ||
         lower.includes('neighborhood experience') ||
         lower.includes('area experience') ||
         lower.includes('local experience') ||
         lower.includes('community experience') ||
         lower.includes('neighborhood opinion') ||
         lower.includes('area opinion') ||
         lower.includes('local opinion') ||
         lower.includes('community opinion') ||
         lower.includes('neighborhood sentiment') ||
         lower.includes('area sentiment') ||
         lower.includes('local sentiment') ||
         lower.includes('community sentiment') ||
         lower.includes('neighborhood reputation') ||
         lower.includes('area reputation') ||
         lower.includes('local reputation') ||
         lower.includes('community reputation')
}

function isLifestyleQuery(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('commute') || 
         lower.includes('commute time') || 
         lower.includes('how far to work') ||
         lower.includes('travel time') ||
         lower.includes('driving distance') ||
         lower.includes('public transport') ||
         lower.includes('metro') ||
         lower.includes('bus') ||
         lower.includes('train') ||
         lower.includes('transit') ||
         lower.includes('transportation') ||
         lower.includes('lifestyle') ||
         lower.includes('day in the life') ||
         lower.includes('daily life') ||
         lower.includes('what\'s it like') ||
         lower.includes('walking distance') ||
         lower.includes('nearby') ||
         lower.includes('close to') ||
         lower.includes('convenient') ||
         lower.includes('accessibility') ||
         lower.includes('restaurants') ||
         lower.includes('shopping') ||
         lower.includes('entertainment') ||
         lower.includes('nightlife') ||
         lower.includes('activities') ||
         lower.includes('family friendly') ||
         lower.includes('pet friendly') ||
         lower.includes('safe') ||
         lower.includes('quiet') ||
         lower.includes('noisy') ||
         lower.includes('parking')
}

function isInvestmentScoreQuery(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('investment score') || 
         lower.includes('investment rating') || 
         lower.includes('investment potential') ||
         lower.includes('investment grade') ||
         lower.includes('how good is this investment') ||
         lower.includes('investment analysis') ||
         lower.includes('investment evaluation') ||
         lower.includes('score this property') ||
         lower.includes('rate this property') ||
         lower.includes('property score') ||
         lower.includes('investment value') ||
         lower.includes('is this a good investment') ||
         lower.includes('investment quality') ||
         lower.includes('investment assessment')
}

function isLocationQuery(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('where is this property') ||
         lower.includes('where is the property') ||
         lower.includes('where is it located') ||
         lower.includes('property location') ||
         lower.includes('what\'s the address') ||
         lower.includes('property address') ||
         lower.includes('location details') ||
         lower.includes('dónde está esta propiedad') ||
         lower.includes('ubicación de la propiedad') ||
         lower.includes('dirección') ||
         lower.includes('localización') ||
         lower.includes('situated') ||
         lower.includes('positioned') ||
         lower.includes('placed') ||
         lower.includes('found') ||
         lower.includes('located at') ||
         lower.includes('address') ||
         lower.includes('location') ||
         lower.includes('where is') ||
         lower.includes('where\'s') ||
         lower.includes('where are') ||
         lower.includes('where can') ||
         lower.includes('where does') ||
         lower.includes('where will') ||
         lower.includes('where would') ||
         lower.includes('where should') ||
         lower.includes('where might') ||
         lower.includes('where could') ||
         lower.includes('where may') ||
         lower.includes('where must') ||
         lower.includes('where shall') ||
         lower.includes('where do') ||
         lower.includes('where did') ||
         lower.includes('where have') ||
         lower.includes('where has') ||
         lower.includes('where had') ||
         lower.includes('address of') ||
         lower.includes('location of') ||
         lower.includes('position of') ||
         lower.includes('place of') ||
         lower.includes('site of') ||
         lower.includes('spot of') ||
         lower.includes('area of') ||
         lower.includes('region of') ||
         lower.includes('zone of') ||
         lower.includes('district of') ||
         lower.includes('neighborhood of') ||
         lower.includes('city of') ||
         lower.includes('state of') ||
         lower.includes('country of') ||
         // Spanish patterns - specific location terms
         lower.includes('dónde está') ||
         lower.includes('dónde se encuentra') ||
         lower.includes('dónde queda') ||
         lower.includes('dónde está ubicada') ||
         lower.includes('dónde está ubicado') ||
         lower.includes('cuál es la dirección') ||
         lower.includes('cuál es la ubicación') ||
         lower.includes('cuál es la localización') ||
         lower.includes('cuál es la posición') ||
         lower.includes('cuál es el lugar') ||
         lower.includes('cuál es el sitio') ||
         lower.includes('cuál es la zona') ||
         lower.includes('cuál es el área') ||
         lower.includes('cuál es la región') ||
         lower.includes('cuál es el distrito') ||
         lower.includes('cuál es el barrio') ||
         lower.includes('cuál es la ciudad') ||
         lower.includes('cuál es el país') ||
         lower.includes('ubicación de la propiedad') ||
         lower.includes('ubicación del inmueble') ||
         lower.includes('ubicación del bien') ||
         lower.includes('dirección de la propiedad') ||
         lower.includes('dirección del inmueble') ||
         lower.includes('dirección del bien') ||
         lower.includes('localización de la propiedad') ||
         lower.includes('localización del inmueble') ||
         lower.includes('localización del bien') ||
         lower.includes('posición de la propiedad') ||
         lower.includes('posición del inmueble') ||
         lower.includes('posición del bien') ||
         lower.includes('lugar de la propiedad') ||
         lower.includes('lugar del inmueble') ||
         lower.includes('lugar del bien') ||
         lower.includes('sitio de la propiedad') ||
         lower.includes('sitio del inmueble') ||
         lower.includes('sitio del bien') ||
         lower.includes('zona de la propiedad') ||
         lower.includes('zona del inmueble') ||
         lower.includes('zona del bien') ||
         lower.includes('área de la propiedad') ||
         lower.includes('área del inmueble') ||
         lower.includes('área del bien') ||
         lower.includes('región de la propiedad') ||
         lower.includes('región del inmueble') ||
         lower.includes('región del bien') ||
         lower.includes('distrito de la propiedad') ||
         lower.includes('distrito del inmueble') ||
         lower.includes('distrito del bien') ||
         lower.includes('barrio de la propiedad') ||
         lower.includes('barrio del inmueble') ||
         lower.includes('barrio del bien') ||
         lower.includes('ciudad de la propiedad') ||
         lower.includes('ciudad del inmueble') ||
         lower.includes('ciudad del bien') ||
         lower.includes('país de la propiedad') ||
         lower.includes('país del inmueble') ||
         lower.includes('país del bien')
}

function isPropertyStatusQuery(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('property status') ||
         lower.includes('listing status') ||
         lower.includes('sale status') ||
         lower.includes('rental status') ||
         lower.includes('rent status') ||
         lower.includes('availability') ||
         lower.includes('available') ||
         lower.includes('for sale') ||
         lower.includes('for rent') ||
         lower.includes('sold') ||
         lower.includes('rented') ||
         lower.includes('pending') ||
         lower.includes('contingent') ||
         lower.includes('under contract') ||
         lower.includes('off market') ||
         lower.includes('withdrawn') ||
         lower.includes('expired') ||
         lower.includes('cancelled') ||
         lower.includes('cancelled') ||
         lower.includes('active') ||
         lower.includes('inactive') ||
         lower.includes('status') ||
         lower.includes('condition') ||
         lower.includes('state') ||
         lower.includes('situation') ||
         lower.includes('circumstance') ||
         lower.includes('position') ||
         lower.includes('placement') ||
         lower.includes('situation') ||
         lower.includes('circumstance') ||
         lower.includes('condition') ||
         lower.includes('state') ||
         lower.includes('status') ||
         // Spanish patterns - specific status terms
         lower.includes('estado de venta') ||
         lower.includes('estado de alquiler') ||
         lower.includes('estado de arrendamiento') ||
         lower.includes('disponibilidad') ||
         lower.includes('disponible') ||
         lower.includes('en venta') ||
         lower.includes('en alquiler') ||
         lower.includes('en arrendamiento') ||
         lower.includes('vendido') ||
         lower.includes('alquilado') ||
         lower.includes('arrendado') ||
         lower.includes('pendiente') ||
         lower.includes('contingente') ||
         lower.includes('bajo contrato') ||
         lower.includes('fuera del mercado') ||
         lower.includes('retirado') ||
         lower.includes('expirado') ||
         lower.includes('cancelado') ||
         lower.includes('activo') ||
         lower.includes('inactivo') ||
         lower.includes('condición') ||
         lower.includes('situación') ||
         lower.includes('circunstancia') ||
         lower.includes('cuál es la disponibilidad') ||
         lower.includes('está disponible') ||
         lower.includes('está en venta') ||
         lower.includes('está en alquiler') ||
         lower.includes('está en arrendamiento')
}

function isTranslationQuery(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('translate') || 
         lower.includes('translation') ||
         lower.includes('traducir') ||
         lower.includes('traduzir') ||
         lower.includes('翻訳') ||
         lower.includes('翻译') ||
         lower.includes('traduire') ||
         lower.includes('übersetzen') ||
         lower.includes('перевести') ||
         lower.includes('ترجمة') ||
         lower.includes('traduci') ||
         lower.includes('перекласти') ||
         lower.includes('traducir') ||
         lower.includes('traduzir') ||
         lower.includes('traduire') ||
         lower.includes('übersetzen') ||
         lower.includes('перевести') ||
         lower.includes('ترجمة') ||
         lower.includes('traduci') ||
         lower.includes('перекласти')
}

// Function to detect if text needs translation
async function needsTranslation(text: string): Promise<boolean> {
  try {
    // Check if text contains non-Latin characters or common non-English patterns
    const hasNonLatin = /[^\u0000-\u007F\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]/.test(text)
    const hasCommonNonEnglish = /[ñáéíóúüçàèìòùâêîôûäëïöüßæøåäöüñçàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(text)
    
    // If it's clearly non-English, it likely needs translation
    if (hasNonLatin || hasCommonNonEnglish) {
      return true
    }
    
    // For short text, be more conservative
    if (text.length < 10) {
      return false
    }
    
    // Check for common non-English words/phrases
    const nonEnglishPatterns = [
      /\b(hola|gracias|por favor|de nada|buenos días|buenas tardes|buenas noches)\b/i,
      /\b(bonjour|merci|s'il vous plaît|de rien|bonne journée|bonsoir)\b/i,
      /\b(guten tag|danke|bitte|gern geschehen|guten morgen|guten abend)\b/i,
      /\b(ciao|grazie|prego|buongiorno|buonasera|buonanotte)\b/i,
      /\b(olá|obrigado|por favor|de nada|bom dia|boa tarde|boa noite)\b/i,
      /\b(привет|спасибо|пожалуйста|добро пожаловать|доброе утро|добрый вечер)\b/i,
      /\b(你好|谢谢|请|不客气|早上好|晚上好)\b/i,
      /\b(こんにちは|ありがとう|お願いします|どういたしまして|おはよう|こんばんは)\b/i,
      /\b(مرحبا|شكرا|من فضلك|أهلا وسهلا|صباح الخير|مساء الخير)\b/i,
      /\b(привіт|дякую|будь ласка|ласкаво просимо|доброго ранку|добрий вечір)\b/i
    ]
    
    return nonEnglishPatterns.some(pattern => pattern.test(text))
  } catch (error) {
    console.log('Error checking translation need:', error)
    return false
  }
}

// Function to translate text using the translate API
async function translateText(text: string, targetLang: string = 'en', sourceLang: string = 'en'): Promise<{ originalText: string; translatedText: string; detectedLang: string; translationRequired: boolean } | null> {
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').origin
    
    const response = await fetch(`${origin}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang })
    })
    
    if (response.ok) {
      return await response.json()
    } else {
      console.error('Translation API error:', response.status, response.statusText)
      return null
    }
  } catch (error) {
    console.error('Error calling translate API:', error)
    return null
  }
}


type SensayClientHeaders = {
  'Content-Type': 'application/json'
  'X-ORGANIZATION-SECRET': string
  'X-USER-ID'?: string
}

async function sensayFetch<T>(path: string, init: { method?: string; headers: SensayClientHeaders; body?: unknown; timeoutMs?: number }, retries = 2): Promise<T> {
  const url = `${SENSAY_BASE_URL}${path}`
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), Math.max(5000, init.timeoutMs ?? 30000))
      
      const response = await fetch(url, {
        method: init.method ?? 'GET',
        headers: init.headers,
        body: init.body ? JSON.stringify(init.body) : undefined,
        // Ensure no caching for chat
        cache: 'no-store',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        const prefix = `${response.status}:${response.statusText}`
        const errorMessage = `${prefix}:{"path":"${path}","method":"${init.method ?? 'GET'}","body":${init.body ? JSON.stringify(init.body) : 'null'},"response":${JSON.stringify(text)}}`
        // Retry on provider 5xx errors
        if ([500, 502, 503, 504].includes(response.status)) {
          throw new Error(errorMessage)
        }
        throw new Error(errorMessage)
      }
      return (await response.json()) as T
    } catch (error) {
      const isLastAttempt = attempt === retries
      const isRetryableError = error instanceof Error && (
        error.message.includes('aborted') || 
        error.message.includes('timeout') || 
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('500:') ||
        error.message.includes('502:') ||
        error.message.includes('503:') ||
        error.message.includes('504:')
      )
      
      if (isLastAttempt || !isRetryableError) {
        throw error
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      console.log(`[ChatAPI] Retry attempt ${attempt + 1}/${retries + 1} for ${path}`)
    }
  }
  
  throw new Error('Max retries exceeded')
}

async function ensureUserExists(apiKey: string, userId: string) {
  const headers: SensayClientHeaders = {
    'Content-Type': 'application/json',
    'X-ORGANIZATION-SECRET': apiKey,
  }
  // Prefer idempotent create; treat 409 as success (already exists)
  try {
    return await sensayFetch<any>(`/users`, {
      method: 'POST',
      headers,
      body: { id: userId },
      timeoutMs: 10000,
    })
  } catch (err) {
    const message = (err as Error).message
    if (message.startsWith('409:')) {
      return { id: userId }
    }
    throw err
  }
}

async function ensureReplicaUuid(apiKey: string, userId: string): Promise<string> {
  const cached = replicaCache.get(userId)
  if (cached) return cached
  const headers: SensayClientHeaders = {
    'Content-Type': 'application/json',
    'X-ORGANIZATION-SECRET': apiKey,
    'X-USER-ID': userId,
  }

  const list = await sensayFetch<{ items: Array<{ uuid: string }> }>(`/replicas`, {
    method: 'GET',
    headers,
    timeoutMs: 10000,
  })

  if (Array.isArray(list?.items) && list.items.length > 0) {
    const uuid = list.items[0].uuid
    replicaCache.set(userId, uuid)
    return uuid
  }

  const created = await sensayFetch<{ uuid: string }>(`/replicas`, {
    method: 'POST',
    headers,
    timeoutMs: 15000,
    body: {
      name: `Sample Replica ${Date.now()}`,
      shortDescription: 'A helpful assistant for demonstration purposes',
      greeting: 'Hello! I am a sample replica. How can I help you today?',
      ownerID: userId,
      private: false,
      slug: `sample-replica-${Date.now()}`,
      llm: { provider: 'openai', model: 'gpt-4o' },
    },
  })
  replicaCache.set(userId, created.uuid)
  return created.uuid
}

async function createFallbackReplica(apiKey: string, userId: string): Promise<string> {
  const headers: SensayClientHeaders = {
    'Content-Type': 'application/json',
    'X-ORGANIZATION-SECRET': apiKey,
    'X-USER-ID': userId,
  }
  // Try a smaller OpenAI model first, then Anthropic
  const candidates = [
    { provider: 'openai', model: 'gpt-4o-mini' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet' },
  ]
  for (const llm of candidates) {
    try {
      const created = await sensayFetch<{ uuid: string }>(`/replicas`, {
        method: 'POST',
        headers,
        timeoutMs: 15000,
        body: {
          name: `Fallback Replica ${Date.now()}`,
          shortDescription: 'Fallback assistant for reliability',
          greeting: 'Hi! I can help with real estate and negotiation.',
          ownerID: userId,
          private: true,
          slug: `fallback-replica-${Date.now()}`,
          llm,
        },
      })
      return created.uuid
    } catch (_) {
      // try next candidate
    }
  }
  throw new Error('Failed to create fallback replica')
}

export async function POST(req: NextRequest) {
  type NegotiationContext = {
    address?: string
    city?: string
    state?: string
    postal?: string
    listPrice?: number
    beds?: number
    baths?: number
    sqft?: number
    status?: string
    dom?: number
    hoaFee?: number
  }

  let lastKnownContext: NegotiationContext = {}
  let wasNegotiation = false
  let incomingMessage: string | undefined
  let hadProjectId = false

  try {
    const apiKey = process.env.SENSAY_API_KEY || process.env.NEXT_PUBLIC_SENSAY_API_KEY
    if (!apiKey) {
      console.error('[ChatAPI] Missing API key. Check your .env.local file.')
      return NextResponse.json({ 
        error: 'Missing SENSAY_API_KEY (or NEXT_PUBLIC_SENSAY_API_KEY). Please check your .env.local file.',
        details: 'Create a .env.local file with: SENSAY_API_KEY=your_api_key_here'
      }, { status: 500 })
    }

    const { message, userId: providedUserId, replicaUuid: providedReplicaUuid, projectId, projectContext, userLanguage: providedUserLanguage } = (await req.json()) as {
      message?: string
      userId?: string
      replicaUuid?: string
      projectId?: string
      projectContext?: unknown
      userLanguage?: string
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 })
    }

    const userId = providedUserId || 'test_user'
    incomingMessage = message

    // Step 1: Language Detection (The Entry Gate)
    const acceptLanguage = req.headers.get('accept-language')
    // Use provided userLanguage from chatbot dialog, or fall back to detection
    const userLanguage = providedUserLanguage || (() => {
      // Detect Japanese from the message content
      const japanesePatterns = [
        /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,  // Hiragana, Katakana, Kanji
        /\b(どこ|何|誰|いつ|なぜ|どの|いくつ|いくら|どれ|どちら|近く|素敵|場所|おすすめ|お勧め|近所|周辺|地域|エリア|場所|スポット|観光|レストラン|カフェ|公園|学校|病院|駅|バス停|地下鉄|電車|バス|タクシー|車|徒歩|歩いて|自転車|バイク|交通|アクセス|便利|近い|遠い|良い|悪い|安全|危険|静か|賑やか|綺麗|汚い|新しい|古い|大きい|小さい|安い|高い|安価|高価|お得|割引|無料|有料|営業|休業|開店|閉店|時間|時刻|今日|明日|昨日|今週|来週|先週|今月|来月|先月|今年|来年|去年|春|夏|秋|冬|天気|晴れ|雨|曇り|雪|風|暑い|寒い|暖かい|涼しい|湿度|乾燥|湿気|快適|不快|心地よい|居心地|雰囲気|空気|環境|自然|緑|花|木|草|川|海|山|丘|平野|都市|田舎|住宅|家|マンション|アパート|一戸建て|集合住宅|オフィス|ビル|建物|施設|設備|アメニティ|サービス|料金|価格|費用|コスト|予算|支払い|決済|購入|売却|賃貸|借りる|貸す|住む|暮らす|生活|日常|毎日|週末|休日|祝日|平日|仕事|学校|通勤|通学|買い物|食事|飲み物|料理|レシピ|食材|材料|調理|味|美味しい|まずい|甘い|辛い|酸っぱい|苦い|塩辛い|薄い|濃い|熱い|冷たい|温かい|冷たい|新鮮|古い|腐った|賞味期限|消費期限|保存|冷蔵|冷凍|解凍|加熱|調理|食事|朝食|昼食|夕食|夜食|軽食|おやつ|デザート|飲み物|水|お茶|コーヒー|ジュース|ビール|ワイン|日本酒|焼酎|ウイスキー|カクテル|ソフトドリンク|アルコール|ノンアルコール|禁酒|禁煙|喫煙|タバコ|煙草|健康|病気|怪我|治療|薬|病院|医者|看護師|薬剤師|歯医者|眼科|耳鼻科|皮膚科|内科|外科|小児科|産婦人科|精神科|心療内科|整形外科|脳外科|心臓外科|消化器科|呼吸器科|循環器科|内分泌科|血液内科|腫瘍科|放射線科|麻酔科|救急科|集中治療科|リハビリテーション科|整形外科|形成外科|美容外科|皮膚科|泌尿器科|肛門科|婦人科|産科|小児科|新生児科|小児外科|小児眼科|小児耳鼻咽喉科|小児皮膚科|小児精神科|小児心療内科|小児整形外科|小児形成外科|小児美容外科|小児泌尿器科|小児肛門科|小児婦人科|小児産科|小児小児科|小児小児外科|小児小児眼科|小児小児耳鼻咽喉科|小児小児皮膚科|小児小児精神科|小児小児心療内科|小児小児整形外科|小児小児形成外科|小児小児美容外科|小児小児泌尿器科|小児小児肛門科|小児小児婦人科|小児小児産科|小児小児新生児科)\b/i
      ]
      
      const hasJapanesePatterns = japanesePatterns.some(pattern => pattern.test(message))
      
      if (hasJapanesePatterns) {
        console.log(`[ChatAPI] Detected Japanese from message content: "${message}"`)
        return 'ja'
      }
      
      // Detect Spanish from the message content with more comprehensive patterns
      const spanishPatterns = [
        /¿[^?]*\?/,  // Spanish question marks
        /[ñáéíóúüçàèìòùâêîôûäëïöüßæøåäöüñçàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/i,  // Spanish characters
        /\b(hola|gracias|por favor|de nada|buenos días|buenas tardes|buenas noches|cuál|cuáles|dónde|qué|quién|quiénes|cómo|cuándo|cuánto|cuánta|cuántos|cuántas|estado|alquiler|arrendamiento|renta|propiedad|inmueble|dirección|ubicación|localización|precio|valor|mercado|análisis|potencial|disponibilidad|venta|compra|inversión|rendimiento|rentabilidad|lugares|cercanos|cerca|interesantes|geniales|genial|buenos|buenas|mejores|mejor|recomendaciones|recomendación|qué hay|qué ver|qué hacer|dónde ir|dónde comer|dónde comprar|dónde estudiar|dónde trabajar|dónde vivir|dónde jugar|dónde correr|dónde caminar|dónde hacer ejercicio|dónde relajarse|dónde divertirse|dónde pasar el tiempo|dónde conocer gente|dónde hacer amigos|dónde socializar|dónde estudiar|dónde trabajar|dónde vivir|dónde jugar|dónde correr|dónde caminar|dónde hacer ejercicio|dónde relajarse|dónde divertirse|dónde pasar el tiempo|dónde conocer gente|dónde hacer amigos|dónde socializar)\b/i
      ]
      
      const hasSpanishPatterns = spanishPatterns.some(pattern => pattern.test(message))
      
      if (hasSpanishPatterns) {
        console.log(`[ChatAPI] Detected Spanish from message content: "${message}"`)
        return 'es'
      }
      
      // Fall back to accept-language header
      const acceptLang = acceptLanguage?.split(',')[0]?.split('-')[0] || 'en'
      console.log(`[ChatAPI] Using accept-language: ${acceptLang}`)
      return acceptLang
    })()
    console.log(`[ChatAPI] Using user language: ${userLanguage}`)

    // Step 2: Input Translation Layer (User message → English)
    let translatedMessage = message
    let inputTranslationInfo = null
    
    if (userLanguage !== 'en') {
      console.log(`[ChatAPI] Translating input from ${userLanguage} to English: "${message}"`)
      const translationResult = await translateText(message, 'en', userLanguage)
      if (translationResult && translationResult.translationRequired) {
        translatedMessage = translationResult.translatedText
        inputTranslationInfo = {
          originalText: translationResult.originalText,
          translatedText: translationResult.translatedText,
          detectedLang: translationResult.detectedLang,
          targetLang: 'en'
        }
        console.log(`[ChatAPI] Input translation successful: ${translationResult.detectedLang} -> en`)
      }
    }

    await ensureUserExists(apiKey, userId)
    const replicaUuid = providedReplicaUuid || (await ensureReplicaUuid(apiKey, userId))

    const headers: SensayClientHeaders & { Accept?: string } = {
      'Content-Type': 'application/json',
      'X-ORGANIZATION-SECRET': apiKey,
      'X-USER-ID': userId,
      // Some providers require explicit Accept header
      Accept: 'application/json',
    }

    // Build a context-enriched content message for better grounding
    let assembledContext: Record<string, any> | undefined
    try {
      const origin = new URL(req.url).origin
      const hasProjectId = typeof projectId === 'string' && projectId.trim().length > 0
      hadProjectId = hasProjectId
      console.log(`[ChatAPI] Context assembly - projectId: ${projectId}, hasProjectId: ${hasProjectId}`)
      let realtorDetails: any | undefined
      let neighborhood: any | undefined

      const now = Date.now()
      const cacheTTLms = 5 * 60 * 1000 // 5 minutes
      if (hasProjectId) {
        const cached = projectCache.get(projectId!)
        if (cached && now - cached.ts < cacheTTLms) {
          realtorDetails = cached.realtorDetails
          neighborhood = cached.neighborhood
        }
      }

      // If not provided via cache or client projectContext, fetch as needed
      if (!realtorDetails && hasProjectId) {
        console.log(`[ChatAPI] Fetching realtor details for projectId: ${projectId}`)
        const detailsRes = await fetch(`${origin}/api/realtor/${encodeURIComponent(projectId!)}`, { cache: 'no-store' })
        if (detailsRes.ok) {
          realtorDetails = await detailsRes.json()
          console.log(`[ChatAPI] Successfully fetched realtor details`)
        } else {
          console.log(`[ChatAPI] Failed to fetch realtor details: ${detailsRes.status}`)
        }
      } else if (realtorDetails) {
        console.log(`[ChatAPI] Using cached realtor details`)
      } else {
        console.log(`[ChatAPI] No projectId, skipping realtor details fetch`)
      }

      const latFromContext = (projectContext as any)?.latitude
      const lonFromContext = (projectContext as any)?.longitude

      const coord =
        (realtorDetails?.data?.home?.location?.address?.coordinate) ||
        (realtorDetails?.home?.location?.address?.coordinate) ||
        (realtorDetails?.location?.address?.coordinate)
      const lat = typeof latFromContext === 'number' ? latFromContext : (coord?.lat ?? coord?.latitude)
      const lon = typeof lonFromContext === 'number' ? lonFromContext : (coord?.lon ?? coord?.lng ?? coord?.longitude)
      
      console.log(`[ChatAPI] Coordinate extraction: coord=`, coord, `lat=${lat}, lon=${lon}`)

      if (!neighborhood && typeof lat === 'number' && typeof lon === 'number') {
        const neighRes = await fetch(`${origin}/api/neighborhood`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: lat, longitude: lon }),
        })
        if (neighRes.ok) {
          neighborhood = await neighRes.json()
        }
      }

      // Fetch yield data if this is a yield-related query
      let yieldData = null
      const isYield = isYieldQuery(translatedMessage)
      console.log(`[ChatAPI] Yield query detection: "${translatedMessage}" -> ${isYield}`)
      // Use default San Francisco coordinates if property coordinates are not available
      const yieldLat = typeof lat === 'number' ? lat : 37.7749
      const yieldLon = typeof lon === 'number' ? lon : -122.4194
      if (isYield) {
        try {
          const propertyPrice = (realtorDetails as any)?.list_price || 800000
          const hoaFees = (realtorDetails as any)?.hoa?.fee || 300
          console.log(`[ChatAPI] Fetching yield data for lat: ${yieldLat}, lon: ${yieldLon}, price: ${propertyPrice}, hoa: ${hoaFees}`)
          
          const yieldRes = await fetch(`${origin}/api/yield`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: yieldLat,
              longitude: yieldLon,
              propertyPrice: propertyPrice,
              hoaFees: hoaFees,
              propertyDescription: realtorDetails?.description?.text
            }),
          })
          if (yieldRes.ok) {
            yieldData = await yieldRes.json()
            console.log(`[ChatAPI] Yield data fetched:`, yieldData)
            
            // Return yield analysis directly instead of passing to LLM
            const capRateEvaluation = yieldData.capRate > 5 ? '✅ Good investment potential' : 
                                     yieldData.capRate > 3 ? '⚠️ Moderate investment potential' : 
                                     '❌ Low investment potential'
            
            // Format location properly
            const locationDisplay = yieldData.address && yieldData.address !== 'Unknown' 
              ? yieldData.address 
              : `Lat: ${yieldLat}, Lng: ${yieldLon}`
            
            const analysisContent = `Rental Yield Analysis:

📍 Location: ${locationDisplay}
💰 Property Price: $${yieldData.propertyPrice.toLocaleString()}
📊 Annual Costs: $${yieldData.annualCosts.toLocaleString()}

💵 Estimated Monthly Rent: $${yieldData.estimatedMonthlyRent.toLocaleString()}
📈 Annual Rental Income: $${yieldData.annualRentalIncome.toLocaleString()}
💸 Net Operating Income: $${yieldData.netOperatingIncome.toLocaleString()}
📊 Cap Rate: ${yieldData.capRate}%

${capRateEvaluation} - Cap rates above 5% are generally considered good for rental properties.`

            // Translate the response to user's language if not English
            let finalAnalysisContent = analysisContent
            if (userLanguage !== 'en') {
              console.log(`[ChatAPI] Translating yield response from English to ${userLanguage}`)
              console.log(`[ChatAPI] Original content: "${analysisContent}"`)
              const translationResult = await translateText(analysisContent, userLanguage, 'en')
              console.log(`[ChatAPI] Translation result:`, translationResult)
              if (translationResult && translationResult.translationRequired) {
                finalAnalysisContent = translationResult.translatedText
                console.log(`[ChatAPI] Yield response translated: "${finalAnalysisContent}"`)
              } else {
                console.log(`[ChatAPI] Translation not required or failed for language: ${userLanguage}`)
              }
            } else {
              console.log(`[ChatAPI] User language is English, no translation needed`)
            }

            return NextResponse.json({ 
              success: true, 
              data: {
                action: 'reply',
                content: finalAnalysisContent
              }
            })
          } else {
            console.error('[ChatAPI] Yield API error:', yieldRes.status, yieldRes.statusText)
          }
        } catch (error) {
          console.error('[ChatAPI] Error fetching yield data:', error)
        }
      }

      // Fetch locality reviews if this is a review-related query
      let reviewData = null
      const isReview = isLocalityReviewQuery(translatedMessage)
      console.log(`[ChatAPI] Review query detection: "${translatedMessage}" -> ${isReview}`)
      
      if (isReview) {
        try {
          // Extract locality name from property data or use coordinates
          let localityQuery = ''
          if (realtorDetails) {
            const address = realtorDetails?.location?.address?.line || realtorDetails?.data?.home?.location?.address?.line
            const city = realtorDetails?.location?.address?.city || realtorDetails?.data?.home?.location?.address?.city
            const state = realtorDetails?.location?.address?.state_code || realtorDetails?.data?.home?.location?.address?.state_code
            localityQuery = [address, city, state].filter(Boolean).join(', ')
          } else if (typeof lat === 'number' && typeof lon === 'number') {
            // Use coordinates to get locality name via reverse geocoding
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${process.env.GOOGLE_MAPS_API_KEY}`
            const geocodeRes = await fetch(geocodeUrl)
            if (geocodeRes.ok) {
              const geocodeData = await geocodeRes.json()
              if (geocodeData.results && geocodeData.results.length > 0) {
                const result = geocodeData.results[0]
                localityQuery = result.formatted_address || result.address_components?.find((c: any) => c.types.includes('locality'))?.long_name || 'this area'
              }
            }
          }
          
          if (localityQuery) {
            console.log(`[ChatAPI] Fetching reviews for locality: ${localityQuery}`)
            
            const reviewRes = await fetch(`${origin}/api/reviews`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                query: localityQuery,
                latitude: lat,
                longitude: lon,
                radius: 3
              }),
            })
            
            if (reviewRes.ok) {
              reviewData = await reviewRes.json()
              console.log(`[ChatAPI] Review data fetched:`, reviewData)
              
              // Return review analysis directly instead of passing to LLM
              const reviewContent = `🏘️ **Neighborhood Reviews for ${reviewData.source || localityQuery}**

${reviewData.summary || 'No reviews available for this area.'}

${reviewData.reviewCount ? `📊 Based on ${reviewData.reviewCount} reviews from ${reviewData.placesReviewed || 1} local establishments` : ''}
${reviewData.averageRating ? `⭐ Average rating: ${reviewData.averageRating}/5` : ''}

💡 **Local Insights:**
${neighborhood ? `
• **Cafes nearby:** ${neighborhood.cafes?.length ? neighborhood.cafes.slice(0, 3).join(', ') : 'None found'}
• **Parks nearby:** ${neighborhood.parks?.length ? neighborhood.parks.slice(0, 3).join(', ') : 'None found'}
• **Schools nearby:** ${neighborhood.schools?.length ? neighborhood.schools.slice(0, 3).join(', ') : 'None found'}
• **Public transport:** ${neighborhood.transport?.length ? neighborhood.transport.slice(0, 2).join(', ') : 'None found'}
` : 'Additional neighborhood data not available'}

📍 **Search Radius:** 3 miles from property location`

              // Translate the response to user's language if not English
              let finalReviewContent = reviewContent
              if (userLanguage !== 'en') {
                console.log(`[ChatAPI] Translating review response from English to ${userLanguage}`)
                const translationResult = await translateText(reviewContent, userLanguage, 'en')
                if (translationResult && translationResult.translationRequired) {
                  finalReviewContent = translationResult.translatedText
                  console.log(`[ChatAPI] Review response translated: "${finalReviewContent}"`)
                }
              }

              return NextResponse.json({ 
                success: true, 
                data: {
                  action: 'reply',
                  content: finalReviewContent
                }
              })
            } else {
              console.error('[ChatAPI] Review API error:', reviewRes.status, reviewRes.statusText)
            }
          } else {
            console.log('[ChatAPI] No locality information available for review query')
          }
        } catch (error) {
          console.error('[ChatAPI] Error fetching review data:', error)
        }
      }

      if (hasProjectId) {
        projectCache.set(projectId!, { realtorDetails, neighborhood, ts: now })
      }

      assembledContext = {
        projectId: projectId ?? null,
        projectContext: projectContext ?? null,
        realtorDetails: realtorDetails ?? null,
        neighborhood: neighborhood ?? null,
        yieldData: yieldData ?? null,
        reviewData: reviewData ?? null,
      }
    } catch (_) {
      // Non-fatal; continue without extra context
    }

    // Compact and cap context size before sending upstream
    const compactedContext = assembledContext
      ? {
          projectId: assembledContext.projectId ?? null,
          projectContext: assembledContext.projectContext ?? null,
          realtorDetails: compactRealtorDetails(assembledContext.realtorDetails),
          neighborhood: compactNeighborhood(assembledContext.neighborhood),
          yieldData: assembledContext.yieldData ?? null,
          reviewData: assembledContext.reviewData ?? null,
        }
      : null

    // Build a very small, plain-text context block instead of embedding raw JSON
    let minimalContextText = ''
    if (compactedContext) {
      const rd = compactedContext.realtorDetails as any
      const nb = compactedContext.neighborhood as any
      const yd = compactedContext.yieldData as any
      const rv = compactedContext.reviewData as any
      const addressLine = rd?.location?.address?.line
      const city = rd?.location?.address?.city
      const state = rd?.location?.address?.state_code
      const postal = rd?.location?.address?.postal_code
      const listPrice = rd?.list_price
      const beds = rd?.description?.beds
      const baths = rd?.description?.baths
      const status = rd?.status
      const dom = rd?.days_on_market
      const hoaFee = rd?.hoa?.fee
      const sqft = rd?.building_size?.size
      lastKnownContext = {
        address: addressLine,
        city,
        state,
        postal,
        listPrice: typeof listPrice === 'number' ? listPrice : undefined,
        beds: typeof beds === 'number' ? beds : undefined,
        baths: typeof baths === 'number' ? baths : undefined,
        sqft: typeof sqft === 'number' ? sqft : undefined,
        status,
        dom: typeof dom === 'number' ? dom : undefined,
        hoaFee: typeof hoaFee === 'number' ? hoaFee : undefined,
      }
      const propertyDescription = rd?.description?.text
      const parts = [
        // Add yield data first if available (highest priority)
        yd && `RENTAL_YIELD_DATA: cap_rate: ${yd.capRate}%, monthly_rent: $${yd.estimatedMonthlyRent}, annual_income: $${yd.annualRentalIncome}, net_income: $${yd.netOperatingIncome}, annual_costs: $${yd.annualCosts}`,
        // Add review data if available
        rv && `NEIGHBORHOOD_REVIEWS: ${rv.summary} (${rv.reviewCount} reviews)`,
        addressLine && `${addressLine}${city ? ', ' + city : ''}${state ? ', ' + state : ''}${postal ? ' ' + postal : ''}`,
        typeof listPrice === 'number' && `list_price: $${listPrice}`,
        (beds || beds === 0) && (baths || baths === 0) && `beds/baths: ${beds}/${baths}`,
        sqft && `sqft: ${sqft}`,
        status && `status: ${status}`,
        (dom || dom === 0) && `days_on_market: ${dom}`,
        (hoaFee || hoaFee === 0) && `hoa_fee: ${hoaFee}`,
        nb?.walkability_score && `walk: ${nb.walkability_score}`,
        // Add property description for context
        propertyDescription && `PROPERTY_DESCRIPTION: ${propertyDescription.slice(0, 500)}${propertyDescription.length > 500 ? '...' : ''}`,
      ].filter(Boolean)
      minimalContextText = parts.join(' | ')
      console.log(`[ChatAPI] Context text: ${minimalContextText}`)
    } else if (projectId || projectContext) {
      minimalContextText = `project: ${projectId ?? 'unknown'}`
    }

    // Handle explicit translation requests
    const isTranslationRequest = isTranslationQuery(translatedMessage)
    if (isTranslationRequest) {
      console.log(`[ChatAPI] Handling translation request: "${message}"`)
      
      // Extract text to translate from the message
      const translationPatterns = [
        /translate\s+(.+)/i,
        /traducir\s+(.+)/i,
        /traduzir\s+(.+)/i,
        /翻訳\s+(.+)/i,
        /翻译\s+(.+)/i,
        /traduire\s+(.+)/i,
        /übersetzen\s+(.+)/i,
        /перевести\s+(.+)/i,
        /ترجمة\s+(.+)/i,
        /traduci\s+(.+)/i,
        /перекласти\s+(.+)/i
      ]
      
      let textToTranslate = message
      for (const pattern of translationPatterns) {
        const match = message.match(pattern)
        if (match) {
          textToTranslate = match[1].trim()
          break
        }
      }
      
      const translationResult = await translateText(textToTranslate, 'en')
      if (translationResult) {
        const translationContent = `🌐 **Translation Result**

**Original Text (${translationResult.detectedLang}):** ${translationResult.originalText}

**Translated Text (English):** ${translationResult.translatedText}

${translationResult.translationRequired ? `✅ Translation completed successfully` : `ℹ️ Already in English`}`

        return NextResponse.json({ 
          success: true, 
          data: {
            action: 'reply',
            content: translationContent,
            translation: translationResult
          }
        })
      } else {
        return NextResponse.json({ 
          success: true, 
          data: {
            action: 'reply',
            content: 'Translation error occurred'
          }
        })
      }
    }

    // Determine if this is a proactive analysis request
    const isProactiveAnalysis = translatedMessage === "PROACTIVE_ANALYSIS" && !!projectId
    const isNegotiation = isNegotiationQuery(translatedMessage, !!projectId)
    const isYield = isYieldQuery(translatedMessage)
    const isReview = isLocalityReviewQuery(translatedMessage)
    const isLifestyle = isLifestyleQuery(translatedMessage)
    const isInvestmentScore = isInvestmentScoreQuery(translatedMessage)
    const isLocation = isLocationQuery(translatedMessage)
    let isPropertyStatus = isPropertyStatusQuery(translatedMessage)
    // Disambiguation: if both yield and property-status match, prefer yield semantics
    if (isYield && isPropertyStatus) {
      console.log('[ChatAPI] Disambiguation: both yield and status matched; preferring yield')
      isPropertyStatus = false
    }
    console.log(`[ChatAPI] Location query detection: "${translatedMessage}" -> ${isLocation}`)
    console.log(`[ChatAPI] Property status query detection: "${translatedMessage}" -> ${isPropertyStatus}`)
    wasNegotiation = isNegotiation
    
    // Use a compact negotiation prompt to reduce token pressure
    const selectedPrompt = isNegotiation ? NEGOTIATION_AGENT_PROMPT_COMPACT : CHAT_SYSTEM_PROMPT

    console.log(`[ChatAPI] Starting chat completion for ${isProactiveAnalysis ? 'proactive analysis' : isNegotiation ? 'negotiation' : isYield ? 'yield' : isReview ? 'review' : isLifestyle ? 'lifestyle' : isInvestmentScore ? 'investment score' : isLocation ? 'location' : isPropertyStatus ? 'property status' : 'general'} query`)
    const startTime = Date.now()
    
    // Handle proactive analysis with special prompt
    if (isProactiveAnalysis) {
      const proactiveAnalysis = await generateProactiveAnalysis(compactedContext)
      return NextResponse.json({ 
        success: true, 
        data: { 
          action: 'reply', 
          content: proactiveAnalysis 
        } 
      })
    }
    
    // Handle review queries - if we have review data, return it directly
    if (isReview && assembledContext?.reviewData) {
      const rd = assembledContext.reviewData as any
      console.log(`[ChatAPI] Including review data in response:`, rd)
      
      const reviewContent = `🏘️ **Neighborhood Reviews for ${rd.source || 'this area'}**

${rd.summary || 'No reviews available for this area.'}

${rd.reviewCount ? `📊 Based on ${rd.reviewCount} reviews from ${rd.placesReviewed || 1} local establishments` : ''}
${rd.averageRating ? `⭐ Average rating: ${rd.averageRating}/5` : ''}

💡 **Local Insights:**
${assembledContext?.neighborhood ? `
• **Cafes nearby:** ${assembledContext.neighborhood.cafes?.length ? assembledContext.neighborhood.cafes.slice(0, 3).join(', ') : 'None found'}
• **Parks nearby:** ${assembledContext.neighborhood.parks?.length ? assembledContext.neighborhood.parks.slice(0, 3).join(', ') : 'None found'}
• **Schools nearby:** ${assembledContext.neighborhood.schools?.length ? assembledContext.neighborhood.schools.slice(0, 3).join(', ') : 'None found'}
• **Public transport:** ${assembledContext.neighborhood.transport?.length ? assembledContext.neighborhood.transport.slice(0, 2).join(', ') : 'None found'}
` : 'Additional neighborhood data not available'}

📍 **Search Radius:** 3 miles from property location`

      return NextResponse.json({ 
        success: true, 
        data: {
          action: 'reply',
          content: reviewContent
        }
      })
    }
    
    // Handle lifestyle queries - if we have neighborhood data, return comprehensive lifestyle analysis
    if (isLifestyle && assembledContext?.neighborhood) {
      const nb = assembledContext.neighborhood
      console.log(`[ChatAPI] Including lifestyle analysis with neighborhood data:`, nb)
      
      const lifestyleContent = `🚶‍♂️ **Lifestyle Analysis for This Neighborhood**

**Walkability & Transportation:**
${nb.walkability_score ? `• Walk Score: ${nb.walkability_score} (${nb.walkability_score > 90 ? 'excellent' : nb.walkability_score > 70 ? 'very good' : nb.walkability_score > 50 ? 'good' : 'limited'} walkability)` : '• Walkability data not available'}
${nb.transport?.length ? `• Public transport: ${nb.transport.slice(0, 3).join(', ')}` : '• Public transport data not available'}

**Local Amenities:**
${nb.cafes?.length ? `• ${nb.cafes.length} cafes nearby: ${nb.cafes.slice(0, 3).join(', ')}` : '• Cafe data not available'}
${nb.parks?.length ? `• ${nb.parks.length} parks within walking distance: ${nb.parks.slice(0, 3).join(', ')}` : '• Park data not available'}
${nb.schools?.length ? `• ${nb.schools.length} schools in the area: ${nb.schools.slice(0, 3).join(', ')}` : '• School data not available'}

**Daily Life Scenarios:**
• **Morning routine:** Start your day with a ${nb.cafes?.length ? '2-3 minute walk to nearby cafes' : 'short walk to local amenities'} for your morning coffee
• **Commute options:** ${nb.transport?.length ? 'Multiple public transport options within 5 minutes' : 'Public transport access varies by location'}
• **Evening activities:** ${nb.parks?.length ? 'Enjoy evening walks in nearby parks' : 'Explore local neighborhood amenities'}
• **Weekend lifestyle:** ${nb.parks?.length && nb.cafes?.length ? 'Perfect for leisurely weekend activities with parks and cafes nearby' : 'Great for exploring local neighborhood features'}

**Neighborhood Character:**
• **Safety:** ${nb.crime_rate ? `Crime rate: ${nb.crime_rate}` : 'Safety data not available'}
• **Community feel:** ${nb.walkability_score && nb.walkability_score > 70 ? 'Highly walkable area with strong community connections' : 'Neighborhood character varies by specific location'}

💡 **Pro Tip:** This area offers a great balance of urban convenience and neighborhood charm, perfect for those who value walkability and local amenities.`

      // Translate the response to user's language if not English
      let finalLifestyleContent = lifestyleContent
      if (userLanguage !== 'en') {
        console.log(`[ChatAPI] Translating lifestyle response from English to ${userLanguage}`)
        const translationResult = await translateText(lifestyleContent, userLanguage, 'en')
        if (translationResult && translationResult.translationRequired) {
          finalLifestyleContent = translationResult.translatedText
          console.log(`[ChatAPI] Lifestyle response translated: "${finalLifestyleContent}"`)
        }
      }

      return NextResponse.json({ 
        success: true, 
        data: {
          action: 'reply',
          content: finalLifestyleContent
        }
      })
    }
    
    // Handle investment score queries
    if (isInvestmentScore && projectId) {
      const { score, reasoning } = calculateInvestmentScore(compactedContext)
      const rd = compactedContext?.realtorDetails
      const listPrice = rd?.list_price
      const ppsf = listPrice && rd?.building_size?.size ? Math.round(listPrice / rd.building_size.size) : null
      const hoaFee = rd?.hoa?.fee
      const dom = rd?.days_on_market
      const beds = rd?.description?.beds
      
      const investmentContent = `📈 **Investment Score: ${score}/10**

**Analysis Breakdown:**
${reasoning.map(r => `• ${r}`).join('\n')}

**Key Metrics:**
${ppsf ? `• Price per sqft: $${ppsf}` : ''}
${hoaFee ? `• HOA fees: $${hoaFee}/month` : ''}
${dom !== undefined ? `• Days on market: ${dom}` : ''}
${beds ? `• Bedrooms: ${beds}` : ''}

**Investment Recommendation:**
${score >= 8 ? 'Excellent investment opportunity with strong fundamentals' : 
  score >= 6 ? 'Good investment with some considerations' : 
  score >= 4 ? 'Moderate investment - consider carefully' : 
  'Challenging investment - significant concerns'}

${score < 6 ? '**Key Concerns:** Consider the factors mentioned above before proceeding with this investment.' : ''}`

      // Translate the response to user's language if not English
      let finalInvestmentContent = investmentContent
      if (userLanguage !== 'en') {
        console.log(`[ChatAPI] Translating investment response from English to ${userLanguage}`)
        const translationResult = await translateText(investmentContent, userLanguage, 'en')
        if (translationResult && translationResult.translationRequired) {
          finalInvestmentContent = translationResult.translatedText
          console.log(`[ChatAPI] Investment response translated: "${finalInvestmentContent}"`)
        }
      }

      return NextResponse.json({ 
        success: true, 
        data: {
          action: 'reply',
          content: finalInvestmentContent
        }
      })
    }
    
    // Handle property status queries
    if (isPropertyStatus && projectId) {
      console.log(`[ChatAPI] Property status query - projectId: ${projectId}`)
      console.log(`[ChatAPI] Property status query - compactedContext available: ${!!compactedContext}`)
      console.log(`[ChatAPI] Property status query - realtorDetails available: ${!!compactedContext?.realtorDetails}`)
      
      const rd = compactedContext?.realtorDetails
      const status = rd?.status
      const dom = rd?.days_on_market
      const listPrice = rd?.list_price
      const address = rd?.location?.address?.line
      const city = rd?.location?.address?.city
      const state = rd?.location?.address?.state_code
      
      console.log(`[ChatAPI] Property status query - status: ${status}, dom: ${dom}, price: ${listPrice}`)
      
      let statusContent = ''
      
      if (status) {
        const statusEmoji = status === 'for_sale' ? '🏠' : 
                           status === 'for_rent' ? '🏘️' : 
                           status === 'sold' ? '✅' : 
                           status === 'pending' ? '⏳' : 
                           status === 'off_market' ? '🚫' : '📋'
        
        const statusText = status === 'for_sale' ? 'For Sale' : 
                          status === 'for_rent' ? 'For Rent' : 
                          status === 'sold' ? 'Sold' : 
                          status === 'pending' ? 'Pending' : 
                          status === 'off_market' ? 'Off Market' : 
                          status === 'contingent' ? 'Contingent' : 
                          status === 'withdrawn' ? 'Withdrawn' : 
                          status === 'expired' ? 'Expired' : 
                          status === 'cancelled' ? 'Cancelled' : 
                          status === 'active' ? 'Active' : 
                          status === 'inactive' ? 'Inactive' : 
                          status
        
        statusContent = `${statusEmoji} **Property Status**

**Current Status:** ${statusText}
${dom !== undefined ? `**Days on Market:** ${dom} days` : ''}
${listPrice ? `**List Price:** $${listPrice.toLocaleString()}` : ''}
${address ? `**Address:** ${address}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}` : ''}

**Status Details:**
${status === 'for_sale' ? '• This property is currently available for purchase' : ''}
${status === 'for_rent' ? '• This property is currently available for rent' : ''}
${status === 'sold' ? '• This property has been sold and is no longer available' : ''}
${status === 'pending' ? '• This property is under contract but not yet closed' : ''}
${status === 'off_market' ? '• This property is not currently available for sale or rent' : ''}
${status === 'contingent' ? '• This property is under contract with contingencies' : ''}
${status === 'withdrawn' ? '• This property has been withdrawn from the market' : ''}
${status === 'expired' ? '• This property listing has expired' : ''}
${status === 'cancelled' ? '• This property listing has been cancelled' : ''}

${dom !== undefined ? `**Market Activity:** ${dom < 15 ? 'Hot market - property listed recently' : dom < 45 ? 'Normal market pace' : 'Slow market - may indicate negotiation opportunity'}` : ''}`
      } else {
        // Try to get status from projectContext as fallback
        const pc = compactedContext?.projectContext as any
        const fallbackStatus = pc?.status
        const fallbackPrice = pc?.price
        
        if (fallbackStatus) {
          const statusEmoji = fallbackStatus === 'for_sale' ? '🏠' : 
                             fallbackStatus === 'for_rent' ? '🏘️' : 
                             fallbackStatus === 'sold' ? '✅' : 
                             fallbackStatus === 'pending' ? '⏳' : 
                             fallbackStatus === 'off_market' ? '🚫' : '📋'
          
          const statusText = fallbackStatus === 'for_sale' ? 'For Sale' : 
                            fallbackStatus === 'for_rent' ? 'For Rent' : 
                            fallbackStatus === 'sold' ? 'Sold' : 
                            fallbackStatus === 'pending' ? 'Pending' : 
                            fallbackStatus === 'off_market' ? 'Off Market' : 
                            fallbackStatus === 'contingent' ? 'Contingent' : 
                            fallbackStatus === 'withdrawn' ? 'Withdrawn' : 
                            fallbackStatus === 'expired' ? 'Expired' : 
                            fallbackStatus === 'cancelled' ? 'Cancelled' : 
                            fallbackStatus === 'active' ? 'Active' : 
                            fallbackStatus === 'inactive' ? 'Inactive' : 
                            fallbackStatus
          
          statusContent = `${statusEmoji} **Property Status**

**Current Status:** ${statusText}
${fallbackPrice ? `**List Price:** $${fallbackPrice.toLocaleString()}` : ''}

**Status Details:**
${fallbackStatus === 'for_sale' ? '• This property is currently available for purchase' : ''}
${fallbackStatus === 'for_rent' ? '• This property is currently available for rent' : ''}
${fallbackStatus === 'sold' ? '• This property has been sold and is no longer available' : ''}
${fallbackStatus === 'pending' ? '• This property is under contract but not yet closed' : ''}
${fallbackStatus === 'off_market' ? '• This property is not currently available for sale or rent' : ''}
${fallbackStatus === 'contingent' ? '• This property is under contract with contingencies' : ''}
${fallbackStatus === 'withdrawn' ? '• This property has been withdrawn from the market' : ''}
${fallbackStatus === 'expired' ? '• This property listing has expired' : ''}
${fallbackStatus === 'cancelled' ? '• This property listing has been cancelled' : ''}

*Note: This status information is from project context and may not be the most current.*`
        } else {
          statusContent = `📋 **Property Status**

Status information is not available for this property. Please check the property details or contact the listing agent for current status information.

**Available Context:**
${compactedContext ? '• Property context is available but no status found' : '• No property context available'}
${projectId ? `• Project ID: ${projectId}` : '• No project ID provided'}`
        }
      }
      
      // Translate the response to user's language if not English
      let finalStatusContent = statusContent
      if (userLanguage !== 'en') {
        console.log(`[ChatAPI] Translating status response from English to ${userLanguage}`)
        const translationResult = await translateText(statusContent, userLanguage, 'en')
        if (translationResult && translationResult.translationRequired) {
          finalStatusContent = translationResult.translatedText
          console.log(`[ChatAPI] Status response translated: "${finalStatusContent}"`)
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        data: {
          action: 'reply',
          content: finalStatusContent
        }
      })
    }
    
    // Handle location queries
    if (isLocation && projectId) {
      console.log(`[ChatAPI] Location query - projectId: ${projectId}`)
      console.log(`[ChatAPI] Location query - compactedContext available: ${!!compactedContext}`)
      console.log(`[ChatAPI] Location query - realtorDetails available: ${!!compactedContext?.realtorDetails}`)
      
      const rd = compactedContext?.realtorDetails
      const address = rd?.location?.address?.line
      const city = rd?.location?.address?.city
      const state = rd?.location?.address?.state_code
      const postal = rd?.location?.address?.postal_code
      
      console.log(`[ChatAPI] Location query - address: ${address}, city: ${city}, state: ${state}, postal: ${postal}`)
      
      let locationContent = ''
      
      if (address) {
        const fullAddress = [address, city, state, postal].filter(Boolean).join(', ')
        locationContent = `📍 **Property Location**

**Address:** ${fullAddress}

${city && state ? `**City/State:** ${city}, ${state}` : ''}
${postal ? `**ZIP Code:** ${postal}` : ''}

This property is located in ${city || 'the specified area'}${state ? `, ${state}` : ''}. The location offers convenient access to local amenities and services.`
      } else {
        // Try to get location from projectContext as fallback
        const pc = compactedContext?.projectContext as any
        const fallbackAddress = pc?.address
        const fallbackCity = pc?.city
        const fallbackState = pc?.state
        
        if (fallbackAddress || fallbackCity) {
          const fallbackLocation = [fallbackAddress, fallbackCity, fallbackState].filter(Boolean).join(', ')
        locationContent = `📍 **Property Location**

**Address:** ${fallbackLocation}

This property is located in ${fallbackCity || 'the specified area'}${fallbackState ? `, ${fallbackState}` : ''}. The location offers convenient access to local amenities and services.`
        } else {
          locationContent = `📍 **Property Location**

Location information is not available for this property. Please check the property details or contact the listing agent for specific address information.

**Available Context:**
${compactedContext ? '• Property context is available but no address found' : '• No property context available'}
${projectId ? `• Project ID: ${projectId}` : '• No project ID provided'}`
        }
      }
      
      // Translate the response to user's language if not English
      let finalLocationContent = locationContent
      if (userLanguage !== 'en') {
        console.log(`[ChatAPI] Translating location response from English to ${userLanguage}`)
        const translationResult = await translateText(locationContent, userLanguage, 'en')
        if (translationResult && translationResult.translationRequired) {
          finalLocationContent = translationResult.translatedText
          console.log(`[ChatAPI] Location response translated: "${finalLocationContent}"`)
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        data: {
          action: 'reply',
          content: finalLocationContent
        }
      })
    }
    
    // If this is a yield query and we have yield data, include it directly in the prompt
    let yieldDataText = ''
    if (isYield && assembledContext?.yieldData) {
      const yd = assembledContext.yieldData as any
      console.log(`[ChatAPI] Including yield data in prompt:`, yd)
      yieldDataText = `\n\nCRITICAL: The user is asking about rental yield. Here is the actual yield data for this property:
RENTAL_YIELD_DATA: cap_rate: ${yd.capRate}%, monthly_rent: $${yd.estimatedMonthlyRent}, annual_income: $${yd.annualRentalIncome}, net_income: $${yd.netOperatingIncome}, annual_costs: $${yd.annualCosts}

You MUST use this data to provide a detailed analysis instead of returning a calculate_yield action. Return {"action": "reply", "content": "Your detailed analysis here"}`
    }

    // If this is a review query and we have review data, include it in the prompt
    let reviewDataText = ''
    if (isReview && assembledContext?.reviewData) {
      const rd = assembledContext.reviewData as any
      console.log(`[ChatAPI] Including review data in prompt:`, rd)
      reviewDataText = `\n\nCRITICAL: The user is asking about neighborhood reviews. Here is the actual review data for this area:
NEIGHBORHOOD_REVIEWS: ${rd.summary} (${rd.reviewCount} reviews from ${rd.placesReviewed} places, avg rating: ${rd.averageRating}/5)

You MUST use this data to provide a detailed analysis instead of returning a get_reviews action. Return {"action": "reply", "content": "Your detailed analysis here"}`
    }

    const rawContent = [
      selectedPrompt,
      minimalContextText ? `Context: ${minimalContextText}` : undefined,
      yieldDataText,
      reviewDataText,
      `User: ${translatedMessage}`,
    ].filter(Boolean).join('\n\n')

    // Cap to avoid upstream 500 due to oversize payload
    // Safe maximum request size for upstream stability
    const MAX_CONTENT = 12000
    const finalContent = rawContent.length > MAX_CONTENT ? rawContent.slice(0, MAX_CONTENT) : rawContent

    console.log(`[ChatAPI] Payload sizes: context=${minimalContextText.length}, raw=${rawContent.length}, final=${finalContent.length}`)
    console.log(`[ChatAPI] Yield data text: ${yieldDataText}`)
    console.log(`[ChatAPI] Final content preview: ${finalContent.slice(0, 500)}...`)
    // Use a single, provider-supported body shape and fallback to a fresh replica on provider errors
    const targetPathBase = `/replicas/${encodeURIComponent(replicaUuid)}/chat/completions`

    const requestWithContent = async (path: string) => {
      return await sensayFetch<any>(path, {
        method: 'POST',
        headers,
        body: { content: finalContent },
        timeoutMs: 45000,
      }, 3)
    }

    let completion: any
    try {
      completion = await requestWithContent(targetPathBase)
    } catch (primaryErr) {
      const msg = (primaryErr as Error)?.message || ''
      const isProviderIssue = msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('Provider returned error')
      if (!isProviderIssue) {
        throw primaryErr
      }
      console.warn('[ChatAPI] Provider error on primary replica, creating fallback replica...')
      const fallbackReplicaUuid = await createFallbackReplica(apiKey, userId)
      const fallbackPath = `/replicas/${encodeURIComponent(fallbackReplicaUuid)}/chat/completions`
      completion = await requestWithContent(fallbackPath)
    }

    const duration = Date.now() - startTime
    console.log(`[ChatAPI] Chat completion completed in ${duration}ms`)
    
    // Step 4: Output Translation Layer (English response → user language)
    let finalResponse = completion
    let outputTranslationInfo = null
    
    if (userLanguage !== 'en' && completion?.content) {
      console.log(`[ChatAPI] Translating output from English to ${userLanguage}`)
      const outputTranslationResult = await translateText(completion.content, userLanguage, 'en')
      if (outputTranslationResult && outputTranslationResult.translationRequired) {
        finalResponse = {
          ...completion,
          content: outputTranslationResult.translatedText
        }
        outputTranslationInfo = {
          originalText: outputTranslationResult.originalText,
          translatedText: outputTranslationResult.translatedText,
          detectedLang: outputTranslationResult.detectedLang,
          targetLang: userLanguage
        }
        console.log(`[ChatAPI] Output translation successful: en -> ${userLanguage}`)
      }
    }
    
    // Include translation information in the response if available
    const responseData = {
      ...finalResponse,
      ...(inputTranslationInfo && { inputTranslation: inputTranslationInfo }),
      ...(outputTranslationInfo && { outputTranslation: outputTranslationInfo }),
      userLanguage // Include detected user language for frontend
    }
    
    return NextResponse.json({ success: true, data: responseData })
  } catch (error) {
    // Graceful fallback so the UI remains responsive even if upstream fails
    const errMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Enhanced logging for debugging
    console.error('[ChatAPI] Error details:', {
      message: errMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      hasApiKey: !!process.env.SENSAY_API_KEY,
      hasPublicApiKey: !!process.env.NEXT_PUBLIC_SENSAY_API_KEY,
      apiKeyLength: process.env.SENSAY_API_KEY?.length || 0,
      apiKeyPrefix: process.env.SENSAY_API_KEY?.substring(0, 8) || 'none',
    })
    
    // More specific error messages based on error type
    let userMessage = 'AI service is temporarily unavailable. Please try again later.'
    
    if (errMessage.includes('Missing SENSAY_API_KEY')) {
      userMessage = 'AI service configuration error. Please contact support.'
    } else if (errMessage.includes('timeout') || errMessage.includes('ECONNREFUSED') || errMessage.includes('aborted') || errMessage.includes('AbortError')) {
      userMessage = 'Request timed out. Please try again.'
    } else if (errMessage.includes('401') || errMessage.includes('403')) {
      userMessage = 'Authentication error. Please contact support.'
    } else if (errMessage.includes('500') || errMessage.includes('502') || errMessage.includes('503') || errMessage.includes('Failed to create fallback replica') || errMessage.includes('Provider returned error') || errMessage.includes('400:')) {
      // Provide a concise, on-brand negotiation draft if the user was asking for negotiation
      if (wasNegotiation) {
        const ppsf = lastKnownContext.listPrice && lastKnownContext.sqft ? Math.round((lastKnownContext.listPrice / lastKnownContext.sqft)) : undefined
        const addr = [lastKnownContext.address, lastKnownContext.city, lastKnownContext.state, lastKnownContext.postal].filter(Boolean).join(', ')
        const anchor = lastKnownContext.listPrice ? Math.round(lastKnownContext.listPrice * 0.88) : undefined
        const reasonParts: string[] = []
        if (ppsf) reasonParts.push(`PPSF ~$${ppsf}`)
        if (typeof lastKnownContext.dom === 'number') reasonParts.push(`${lastKnownContext.dom} DOM`)
        if (lastKnownContext.hoaFee || lastKnownContext.hoaFee === 0) reasonParts.push(`HOA $${lastKnownContext.hoaFee}/mo`)
        const reasons = reasonParts.slice(0, 3).join(', ')
        const shortAddr = addr || 'this property'
        const draft = anchor
          ? `Hey—thanks for the details on ${shortAddr}. Given condition and market tempo, I'm at $${anchor} to start. Rationale: ${reasons || 'market positioning and comps'}. Happy to move on terms (faster close, clean contingencies) for value alignment. What's seller flexibility like?`
          : `Hey—on ${shortAddr}, I'd start with a below-ask anchor tied to faster close and clean contingencies. Rationale: ${reasons || 'market positioning and comps'}. What's seller flexibility like?`
        userMessage = draft
      } else {
        userMessage = 'Service temporarily unavailable. Please try again in a moment.'
      }
    }
    
    const fallback = {
      action: 'reply',
      content: userMessage,
      meta: { reason: 'upstream_error', detail: errMessage },
    }
    return NextResponse.json({ success: true, data: fallback })
  }
}


