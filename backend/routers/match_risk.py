from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.matching_engine import hedge_risk
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

@router.post("/hedge-risk")
async def hedge_risk_endpoint(request: RiskRequest):
    """
    Match a business risk description to relevant Polymarket markets using search-based flow.
    """
    print("\n" + "="*80)
    print("[API] ===== HEDGE-RISK ENDPOINT CALLED =====")
    print(f"[API] Risk description length: {len(request.risk_description)} chars")
    print(f"[API] Risk description: {request.risk_description[:200]}...")
    print("="*80)
    
    try:
        if not request.risk_description or len(request.risk_description.strip()) == 0:
            print("[API] ERROR: Empty risk description")
            raise HTTPException(status_code=400, detail="Risk description cannot be empty")
        
        print("[API] Calling hedge_risk function...")
        matched_markets = hedge_risk(request.risk_description, top_k=10000)
        
        print(f"[API] match_risk returned {len(matched_markets)} markets")
        
        if not matched_markets:
            print("[API] No matches found, returning empty result")
            return {
                "matches": [],
                "message": "No matching markets found. Try refining your risk description."
            }
        
        # Format response (exclude rawMarket)
        print("[API] Formatting response...")
        formatted_markets = []
        for i, market in enumerate(matched_markets):
            formatted = {
                "marketId": market.get("marketId", ""),
                "title": market.get("title", "Unknown"),
                "description": market.get("description", "")[:500],  # Truncate long descriptions
                "category": market.get("category", ""),
                "eventTitle": market.get("eventTitle"),
                "eventDescription": market.get("eventDescription"),
                "startDate": market.get("startDate"),
                "endDate": market.get("endDate"),
                "side": market.get("side"),
                "clobTokenId": market.get("clobTokenId"),
                "clobTokenIds": market.get("clobTokenIds"),
                "outcomes": market.get("outcomes"),
                "outcomePrices": market.get("outcomePrices"),
                "liquidity": market.get("liquidity"),
                "volume": market.get("volume"),
            }
            formatted_markets.append(formatted)
            print(f"[API] Formatted market {i+1}: {formatted['title'][:60]}...")
        
        print(f"[API] Returning {len(formatted_markets)} formatted markets")
        print("="*80 + "\n")
        
        return {
            "matches": formatted_markets,
            "count": len(formatted_markets)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] ERROR in match_risk_endpoint: {e}")
        import traceback
        print(f"[API] Traceback: {traceback.format_exc()}")
        print("="*80 + "\n")
        raise HTTPException(status_code=500, detail=f"Error matching risk: {str(e)}")


@router.post("/match-risk")
async def match_risk_endpoint(request: RiskRequest):
    """
    Backward-compatible alias to hedge-risk.
    """
    return await hedge_risk_endpoint(request)

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

