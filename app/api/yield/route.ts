import { NextResponse } from 'next/server';

// Function to adjust rental estimate based on property characteristics vs median
function adjustRentForPropertyCharacteristics(
  baseRent: number,
  propertyPrice: number,
  beds?: number,
  baths?: number,
  sqft?: number,
  propertyType?: string,
  yearBuilt?: number,
  propertyDescription?: string
): number {
  let adjustmentFactor = 1.0;
  
  // 1. Price-based adjustment (most important factor)
  // For luxury properties, we still want to maintain reasonable rental yields
  if (propertyPrice > 2000000) {
    // Ultra-luxury: $2M+ - limited but still substantial rental market
    adjustmentFactor *= 0.9; // 10% reduction (maintains 3%+ yield)
  } else if (propertyPrice > 1000000) {
    // Luxury: $1M-2M - some rental market
    adjustmentFactor *= 0.95; // 5% reduction (maintains 3.5%+ yield)
  } else if (propertyPrice > 800000) {
    // High-end: $800k-1M - good rental market
    adjustmentFactor *= 0.98; // 2% reduction (maintains 4%+ yield)
  } else if (propertyPrice < 200000) {
    // Budget: Under $200k - more rental-friendly
    adjustmentFactor *= 1.2; // 20% increase
  }
  
  // 2. Property type adjustment
  if (propertyType === 'single_family') {
    // Single family homes at high prices are rarely rented, but still maintain yield
    if (propertyPrice > 600000) {
      adjustmentFactor *= 0.95; // Additional 5% reduction for expensive SFH (maintains yield)
    }
  } else if (propertyType === 'condo' || propertyType === 'townhouse') {
    // Condos and townhouses are more commonly rented
    adjustmentFactor *= 1.1; // 10% increase
  }
  
  // 3. Size-based adjustment (price per sqft consideration)
  if (sqft && propertyPrice) {
    const pricePerSqft = propertyPrice / sqft;
    if (pricePerSqft > 800) {
      // Very high-end per sqft - likely luxury finishes
      adjustmentFactor *= 0.7; // 30% reduction
    } else if (pricePerSqft > 600) {
      // High-end per sqft
      adjustmentFactor *= 0.85; // 15% reduction
    } else if (pricePerSqft < 200) {
      // Budget per sqft - more rental-friendly
      adjustmentFactor *= 1.15; // 15% increase
    }
  }
  
  // 4. Bedroom/bathroom adjustment
  if (beds && baths) {
    const bedBathRatio = beds / baths;
    if (bedBathRatio < 0.5) {
      // More bathrooms than bedrooms - luxury feature
      adjustmentFactor *= 0.9; // 10% reduction
    } else if (beds >= 5) {
      // Large homes are harder to rent
      adjustmentFactor *= 0.8; // 20% reduction
    }
  }
  
  // 5. Age adjustment
  if (yearBuilt) {
    const age = new Date().getFullYear() - yearBuilt;
    if (age < 5) {
      // Very new construction - likely luxury
      adjustmentFactor *= 0.9; // 10% reduction
    } else if (age > 30) {
      // Older homes - more rental-friendly
      adjustmentFactor *= 1.05; // 5% increase
    }
  }
  
  // 6. Property description analysis (NEW)
  if (propertyDescription) {
    const descLower = propertyDescription.toLowerCase();
    
    // Positive factors that increase rental value
    if (descLower.includes('development opportunity') || descLower.includes('entitled')) {
      adjustmentFactor *= 1.15; // 15% increase for development potential
    }
    if (descLower.includes('2 unit building') || descLower.includes('multiple units') || descLower.includes('duplex')) {
      adjustmentFactor *= 1.2; // 20% increase for multi-unit properties
    }
    if (descLower.includes('outdoor spaces') || descLower.includes('patio') || descLower.includes('balcony')) {
      adjustmentFactor *= 1.05; // 5% increase for outdoor amenities
    }
    if (descLower.includes('good condition') || descLower.includes('livable') || descLower.includes('move-in ready')) {
      adjustmentFactor *= 1.08; // 8% increase for good condition
    }
    if (descLower.includes('natural light') || descLower.includes('flexible floor plan')) {
      adjustmentFactor *= 1.03; // 3% increase for desirable features
    }
    if (descLower.includes('prime') || descLower.includes('coveted') || descLower.includes('walking distance')) {
      adjustmentFactor *= 1.1; // 10% increase for location advantages
    }
    
    // Negative factors that decrease rental value
    if (descLower.includes('needs renovation') || descLower.includes('fixer') || descLower.includes('tear down')) {
      adjustmentFactor *= 0.8; // 20% reduction for properties needing work
    }
    if (descLower.includes('unique opportunity') && descLower.includes('could not be entitled')) {
      adjustmentFactor *= 0.9; // 10% reduction for properties that may be overpriced due to uniqueness
    }
  }
  
  // Ensure minimum adjustment factor to avoid unrealistic rents
  adjustmentFactor = Math.max(0.1, Math.min(2.0, adjustmentFactor));
  
  return Math.round(baseRent * adjustmentFactor);
}

// This is the main handler for POST requests to /api/investment-potential
export async function POST(request: Request) {
  try {
    // 1. Extract property data from the incoming request body
    const { 
      address, 
      latitude, 
      longitude, 
      propertyPrice, 
      hoaFees,
      beds,
      baths,
      sqft,
      propertyType,
      yearBuilt,
      propertyDescription
    } = await request.json();

    // Basic validation to ensure required data is present
    if ((!address && (!latitude || !longitude)) || !propertyPrice || hoaFees === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: Either address OR (latitude and longitude) are required, plus propertyPrice and hoaFees.' },
        { status: 400 }
      );
    }
    
    // Ensure numbers are valid
    if (typeof propertyPrice !== 'number' || typeof hoaFees !== 'number' || propertyPrice <= 0 || hoaFees < 0) {
        return NextResponse.json(
            { error: 'Invalid data type: propertyPrice and hoaFees must be numbers, propertyPrice must be greater than 0, and hoaFees must be non-negative.' },
            { status: 400 }
        );
    }

    // Calculate annual costs: HOA * 12 + 5% of property price
    const annualCosts = (hoaFees * 12) + (propertyPrice * 0.05);

    // Validate latitude and longitude if provided
    if (latitude !== undefined && longitude !== undefined) {
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || 
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return NextResponse.json(
          { error: 'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180.' },
          { status: 400 }
        );
      }
    }

    // 2. Fetch rental estimate from an external API (RentCast)
    const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY || 'YOUR_RENTCAST_API_KEY';
    
    if (RENTCAST_API_KEY === 'YOUR_RENTCAST_API_KEY') {
        console.warn("Using default RentCast API key. Please replace with your actual key.");
    }

    // Build the API URL based on whether we have address or coordinates
    let rentcastUrl;
    if (address) {
      rentcastUrl = `https://api.rentcast.io/v1/avm/rent/long-term?address=${encodeURIComponent(address)}`;
    } else {
      // For coordinates, we'll try the coordinates endpoint first, then fallback to reverse geocoding
      rentcastUrl = `https://api.rentcast.io/v1/avm/rent/long-term?latitude=${latitude}&longitude=${longitude}`;
    }

    const rentcastResponse = await fetch(rentcastUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': RENTCAST_API_KEY,
      },
    });

    if (!rentcastResponse.ok) {
      // If the external API call fails, use a fallback calculation
      console.warn('RentCast API failed, using fallback calculation');
      
      // Fallback: Estimate rent based on property price and location
      // Use realistic percentages that ensure minimum 3% annual yield for luxury properties
      let fallbackRent;
      if (propertyPrice > 2000000) {
        // Ultra-luxury: should generate at least 3% annual yield (0.35% monthly to account for adjustments)
        fallbackRent = Math.round(propertyPrice * 0.0035); // 0.35% of property value = 4.2% annual, adjusted to ~3%
      } else if (propertyPrice > 1000000) {
        // Luxury: should generate at least 3.5% annual yield (0.4% monthly)
        fallbackRent = Math.round(propertyPrice * 0.004); // 0.4% of property value = 4.8% annual, adjusted to ~3.5%
      } else if (propertyPrice > 500000) {
        // High-end: should generate at least 4% annual yield (0.45% monthly)
        fallbackRent = Math.round(propertyPrice * 0.0045); // 0.45% of property value = 5.4% annual, adjusted to ~4%
      } else {
        // Standard: should generate at least 5% annual yield (0.6% monthly)
        fallbackRent = Math.round(propertyPrice * 0.006); // 0.6% of property value = 7.2% annual, adjusted to ~5%
      }
      
      // Ensure minimum rent
      fallbackRent = Math.max(500, fallbackRent);
      
      console.log('Using fallback rent calculation:', fallbackRent);
      
      // Use the fallback rent as base rent, then add 0.5% of property value
      const baseMonthlyRent = fallbackRent;
      const propertyValueAddition = Math.round(propertyPrice * 0.005); // 0.5% of property value
      const adjustedMonthlyRent = baseMonthlyRent + propertyValueAddition;
      
      const annualRentalIncome = adjustedMonthlyRent * 12;
      const netOperatingIncome = annualRentalIncome - annualCosts;
      const capRate = (netOperatingIncome / propertyPrice) * 100;
      
      return NextResponse.json({
        address: address || `Lat: ${latitude}, Lng: ${longitude}`,
        coordinates: latitude && longitude ? { latitude, longitude } : undefined,
        propertyPrice: propertyPrice,
        hoaFees: hoaFees,
        annualCosts: annualCosts,
        costBreakdown: {
          hoaAnnual: hoaFees * 12,
          propertyTaxesAndMaintenance: propertyPrice * 0.05
        },
        estimatedMonthlyRent: adjustedMonthlyRent,
        baseMonthlyRent: baseMonthlyRent,
        annualRentalIncome: annualRentalIncome,
        netOperatingIncome: netOperatingIncome,
        capRate: parseFloat(capRate.toFixed(2)),
        fallbackUsed: true
      });
    }

    const rentalData = await rentcastResponse.json();
    const baseMonthlyRent = rentalData.price || rentalData.rent || rentalData.estimatedRent;

    if (!baseMonthlyRent) {
        return NextResponse.json(
            { error: 'Could not determine rental estimate for the provided location.' },
            { status: 404 }
        );
    }

    // 3. Adjust rental estimate based on property characteristics
    const adjustedMonthlyRent = adjustRentForPropertyCharacteristics(
      baseMonthlyRent,
      propertyPrice,
      beds,
      baths,
      sqft,
      propertyType,
      yearBuilt,
      propertyDescription
    );

    // 4. Perform the Investment Calculations
    const annualRentalIncome = adjustedMonthlyRent * 12;

    // Net Operating Income (NOI) is the annual income minus annual costs
    const netOperatingIncome = annualRentalIncome - annualCosts;

    // Capitalization Rate (Cap Rate) calculation
    const capRate = (netOperatingIncome / propertyPrice) * 100;

    // 4. Return the calculated data in the response
    return NextResponse.json({
      address: address || `Lat: ${latitude}, Lng: ${longitude}`,
      coordinates: latitude && longitude ? { latitude, longitude } : undefined,
      propertyPrice: propertyPrice,
      hoaFees: hoaFees,
      annualCosts: annualCosts,
      costBreakdown: {
        hoaAnnual: hoaFees * 12,
        propertyTaxesAndMaintenance: propertyPrice * 0.05
      },
      estimatedMonthlyRent: adjustedMonthlyRent,
      baseMonthlyRent: baseMonthlyRent,
      annualRentalIncome: annualRentalIncome,
      netOperatingIncome: netOperatingIncome,
      // We round the cap rate to two decimal places for a cleaner result
      capRate: parseFloat(capRate.toFixed(2)), 
    });

  } catch (error) {
    // General error handler for any other issues
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
