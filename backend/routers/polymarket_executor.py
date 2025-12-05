from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.polymarket_executor import execute_order

router = APIRouter()


class ExecuteOrderRequest(BaseModel):
    marketId: str
    outcomeIndex: int
    side: str  # "buy" | "sell"
    size: float
    limitPrice: float
    ttlSeconds: int | None = None
    maxSlippageBps: int | None = None
    dryRun: bool | None = None
    tokenId: str | None = None


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

