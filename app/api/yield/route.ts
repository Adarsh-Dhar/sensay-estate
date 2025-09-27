import { NextResponse } from 'next/server';

// This is the main handler for POST requests to /api/investment-potential
export async function POST(request: Request) {
  try {
    // 1. Extract property data from the incoming request body
    const { address, latitude, longitude, propertyPrice, hoaFees } = await request.json();

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
      // If the external API call fails, return an error
      const errorData = await rentcastResponse.json();
      console.error('RentCast API Error:', errorData);
      return NextResponse.json(
        { error: 'Failed to fetch rental estimate from external service.', details: errorData },
        { status: rentcastResponse.status }
      );
    }

    const rentalData = await rentcastResponse.json();
    const estimatedMonthlyRent = rentalData.price || rentalData.rent || rentalData.estimatedRent;

    if (!estimatedMonthlyRent) {
        return NextResponse.json(
            { error: 'Could not determine rental estimate for the provided location.' },
            { status: 404 }
        );
    }

    // 3. Perform the Investment Calculations
    const annualRentalIncome = estimatedMonthlyRent * 12;

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
      estimatedMonthlyRent: estimatedMonthlyRent,
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
