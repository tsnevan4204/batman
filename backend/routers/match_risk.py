from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.matching_engine import match_risk
from services.polymarket import load_markets

router = APIRouter()

class RiskRequest(BaseModel):
    risk_description: str

class MarketResponse(BaseModel):
    marketId: str
    title: str
    description: str
    category: str
    similarity: float
    currentPrice: float | None
    liquidity: float | None

@router.post("/match-risk")
async def match_risk_endpoint(request: RiskRequest):
    """
    Match a business risk description to relevant Polymarket markets.
    """
    try:
        if not request.risk_description or len(request.risk_description.strip()) == 0:
            raise HTTPException(status_code=400, detail="Risk description cannot be empty")
        
        matched_markets = match_risk(request.risk_description, top_k=5)
        
        if not matched_markets:
            return {
                "matches": [],
                "message": "No matching markets found. Try refining your risk description."
            }
        
        # Format response (exclude rawMarket)
        formatted_markets = []
        for market in matched_markets:
            formatted_markets.append({
                "marketId": market["marketId"],
                "title": market["title"],
                "description": market["description"],
                "category": market.get("category", ""),
                "similarity": round(market["similarity"], 4),
                "currentPrice": market.get("currentPrice"),
                "liquidity": market.get("liquidity")
            })
        
        return {
            "matches": formatted_markets,
            "count": len(formatted_markets)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error matching risk: {str(e)}")

@router.get("/markets")
async def get_markets():
    """
    Get all cached markets from markets.json.
    """
    try:
        markets = load_markets()
        return {
            "markets": markets,
            "count": len(markets)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading markets: {str(e)}")

