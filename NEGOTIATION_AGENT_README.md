# Property Negotiation Agent

## Overview
I've created a comprehensive property negotiation agent for your Neighborhood Navigator platform that leverages all available property data from the Realtor API to provide strategic negotiation advice.

## Key Features

### 1. **Intelligent Query Detection**
The system automatically detects when a user is asking about property negotiation, pricing, or market analysis based on keywords like:
- "negotiate", "offer", "price", "market value"
- "overpriced", "underpriced", "fair price"
- "should I buy", "buying advice", "comparable"
- "inspection", "contingency", "financing"

### 2. **Comprehensive Property Data Analysis**
The negotiation agent has access to all property information from your Realtor API:
- **Basic Info**: list_price, beds, baths, sqft, property_type, status, days_on_market
- **Location Data**: full address, coordinates, city, state, postal_code
- **Financial Details**: HOA fees, property taxes, price per sqft
- **Property Features**: description, photos, amenities, building details
- **Market Data**: comparable sales, price history, market trends
- **Neighborhood Info**: schools, walkability, crime rates, demographics, local amenities
- **Property History**: listing history, price changes, market performance

### 3. **Strategic Negotiation Framework**
The agent provides analysis across multiple dimensions:

#### **Negotiation Strategies**
1. **Market Comparison** - Compare with similar properties in the area
2. **Value Assessment** - Analyze property value based on features and condition
3. **Price Analysis** - Evaluate if asking price is fair or overpriced
4. **Timing Strategy** - Consider market timing and seller motivation
5. **Leverage Points** - Identify negotiation advantages and weaknesses
6. **Contingency Planning** - Suggest inspection, financing, and closing strategies

#### **Analysis Framework**
- **Price Analysis**: Compare list_price to recent sales, price per sqft, market trends
- **Market Position**: Days on market, price changes, competition analysis
- **Property Value**: Features, condition, location advantages, unique selling points
- **Negotiation Leverage**: Seller motivation, market conditions, property drawbacks
- **Risk Assessment**: Market volatility, property condition, financing challenges
- **Timing Factors**: Seasonal trends, interest rates, local market dynamics

### 4. **Structured Response Format**
When providing negotiation advice, the agent structures analysis around:
1. **Current Market Position** - Where this property sits in the market
2. **Value Assessment** - Fair market value estimation
3. **Negotiation Strategy** - Specific approach based on data
4. **Key Leverage Points** - What gives you negotiation power
5. **Suggested Offer Range** - Data-driven offer recommendations
6. **Risk Factors** - Potential challenges to consider
7. **Next Steps** - Concrete actions to take

### 5. **Key Metrics Analysis**
The agent analyzes critical metrics:
- Price per square foot vs. neighborhood average
- Days on market vs. local average
- Price changes and market trends
- Comparable property sales in last 6 months
- School district ratings and walkability scores
- HOA fees and additional costs
- Property condition and maintenance needs
- Local market inventory and competition

## Implementation Details

### Files Modified
1. **`app/api/chat/prompt.ts`** - Added `NEGOTIATION_AGENT_PROMPT` with comprehensive negotiation guidance
2. **`app/api/chat/route.ts`** - Added negotiation query detection and prompt selection logic

### How It Works
1. User asks a question about a specific property (requires projectId)
2. System detects if it's a negotiation-related query using keyword matching
3. If negotiation query detected, uses `NEGOTIATION_AGENT_PROMPT` instead of standard `CHAT_SYSTEM_PROMPT`
4. Agent receives full property context including realtor details and neighborhood data
5. Agent provides structured negotiation analysis and recommendations

### Example Usage
When a user is viewing a property and asks:
- "Help me negotiate this property"
- "What should I offer?"
- "Is this property overpriced?"
- "What's the market value?"
- "Should I buy this house?"

The system will automatically switch to the negotiation agent and provide comprehensive, data-driven advice.

## Benefits
- **Data-Driven**: Uses actual property and market data for recommendations
- **Comprehensive**: Covers all aspects of property negotiation
- **Strategic**: Provides multiple negotiation approaches based on market conditions
- **Actionable**: Gives specific next steps and concrete advice
- **Context-Aware**: Leverages neighborhood and market data for better insights

The negotiation agent is now fully integrated into your existing chat system and will automatically activate when users ask property-specific negotiation questions.
