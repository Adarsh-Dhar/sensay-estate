# Property Negotiation Agent - Data Integration Example

## How the Negotiation Agent Uses Property Data

The negotiation agent now extracts and uses specific property data from the Realtor API to provide data-driven negotiation advice. Here's how it works:

### 1. **Property Data Extraction**
The agent automatically extracts key property information using these patterns:

```javascript
// Example property data structure from realtorDetails
const propertyData = {
  list_price: 450000,
  beds: 3,
  baths: 2,
  sqft: 1200,
  year_built: 2015,
  property_type: "Single Family",
  status: "For Sale",
  days_on_market: 45,
  hoa_fee: 200,
  address: "123 Main St, Austin, TX 78701",
  description: "Beautiful 3-bedroom home with updated kitchen...",
  photos: [...],
  nearby_schools: [...]
}
```

### 2. **Automatic Calculations**
The agent performs real-time calculations:

- **Price per sqft**: $450,000 ÷ 1,200 sqft = $375/sqft
- **Total monthly cost**: ($450,000 × 0.08 ÷ 12) + $200 HOA = $3,200/month
- **Property age**: 2024 - 2015 = 9 years old
- **Market position**: 45 days on market (above average 30-60 day range)

### 3. **Sample Negotiation Response**

When a user asks "What should I offer for this property?", the agent will respond with:

```json
{
  "action": "negotiate",
  "content": "Based on the property data: This 3-bed, 2-bath, 1,200 sqft home at $450,000 ($375/sqft) has been on market for 45 days. The HOA fee of $200/month brings total monthly costs to approximately $3,200. Compared to similar properties in Austin, this is 8% above market average. The property's 9-year age and updated features suggest a market_comparison strategy. Key leverage points include the extended days on market and above-market pricing. Suggested offer range: $415,000-$425,000 (8-10% below asking). Risk factors include potential maintenance needs due to age. Next steps: Schedule inspection, verify HOA financials, and prepare financing pre-approval.",
  "strategy": "market_comparison",
  "key_points": ["45 days on market", "$375/sqft pricing", "HOA costs", "Property age"],
  "suggested_offer": 420000,
  "market_analysis": "Austin market showing 8% premium over comparable properties"
}
```

### 4. **Data-Driven Analysis Framework**

The agent analyzes:

#### **Price Analysis**
- Calculates actual price per sqft from property data
- Compares to neighborhood averages using market data
- Analyzes price history and trends

#### **Market Position**
- Uses days_on_market to assess seller motivation
- Evaluates status and listing history
- Considers seasonal and market timing factors

#### **Property Value Assessment**
- Reviews beds, baths, sqft, year_built, lot_size
- Analyzes property features and amenities
- Assesses location advantages and school ratings

#### **Financial Impact**
- Calculates total monthly costs including HOA
- Factors in property taxes and insurance estimates
- Provides realistic budget planning

#### **Negotiation Strategy**
- Identifies specific leverage points from data
- Suggests data-driven offer amounts
- Recommends inspection and financing contingencies

### 5. **Key Features**

✅ **Real Property Data**: Uses actual list_price, beds, baths, sqft, etc.
✅ **Automatic Calculations**: Performs price per sqft, monthly costs, property age
✅ **Market Comparison**: Compares against neighborhood averages
✅ **Financial Analysis**: Includes HOA fees, taxes, total monthly costs
✅ **Leverage Identification**: Uses days on market, price history, market position
✅ **Concrete Recommendations**: Provides specific offer amounts and next steps
✅ **Risk Assessment**: Considers property age, condition, market trends

### 6. **Example Negotiation Scenarios**

**Scenario 1: Overpriced Property**
- Property: $500,000, 1,000 sqft ($500/sqft), 60 days on market
- Analysis: "This property is priced 15% above neighborhood average at $500/sqft. With 60 days on market, the seller may be motivated to negotiate. Suggested offer: $450,000-$460,000."

**Scenario 2: Well-Priced Property**
- Property: $400,000, 1,200 sqft ($333/sqft), 15 days on market
- Analysis: "This property is competitively priced at $333/sqft, below neighborhood average. With only 15 days on market, expect competition. Suggested offer: $400,000-$410,000 with strong contingencies."

**Scenario 3: Older Property with Issues**
- Property: $350,000, 1,500 sqft ($233/sqft), 30 years old, 90 days on market
- Analysis: "This 30-year-old property has been on market for 90 days, suggesting potential issues. The low price per sqft may indicate needed repairs. Suggested offer: $320,000-$330,000 with thorough inspection contingency."

The negotiation agent now provides professional-grade, data-driven real estate negotiation advice using the actual property details from your Realtor API integration.
