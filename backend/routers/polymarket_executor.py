from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.polymarket_executor import execute_order
from services.polymarket import fetch_top_events

router = APIRouter()


class ExecuteOrderRequest(BaseModel):
    marketId: str
    outcomeIndex: int
    side: str  # "buy" | "sell"
    size: float
    limitPrice: float
    ttlSeconds: Optional[int] = None
    maxSlippageBps: Optional[int] = None
    dryRun: Optional[bool] = None
    tokenId: Optional[str] = None


@router.post("/execute-order")
async def execute_order_endpoint(req: ExecuteOrderRequest):
    """
    Server-side Polymarket execution: builds, signs, and submits an order to CLOB.
    """
    try:
        print(f"[api/execute-order] request body: {req}")
        result = execute_order(
            market_id=req.marketId,
            outcome_index=req.outcomeIndex,
            side=req.side,
            size=req.size,
            limit_price=req.limitPrice,
            ttl_seconds=req.ttlSeconds,
            max_slippage_bps=req.maxSlippageBps,
            dry_run=req.dryRun if req.dryRun is not None else True,
            token_id=req.tokenId,
        )
        return result
    except Exception as e:
        print(f"[api/execute-order] error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/polymarket-top")
async def get_polymarket_top(limit: int = 5):
    """
    Proxy endpoint to fetch top Polymarket events (volume ordered) via backend to avoid CORS.
    """
    try:
        events = fetch_top_events(limit=limit)
        return {"events": events, "count": len(events)}
    except Exception as e:
        print(f"[api/polymarket-top] error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch Polymarket events: {e}")