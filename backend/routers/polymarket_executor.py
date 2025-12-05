from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid

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


@router.post("/execute-order")
async def execute_order_endpoint(req: ExecuteOrderRequest):
    """
    Server-side Polymarket execution: on testnet we force dryRun and return
    a simulated trade hash so the UI can proceed through the flow.
    """
    try:
        print(f"[api/execute-order] request body: {req}")
        # Force dryRun on testnet
        result = execute_order(
            market_id=req.marketId,
            outcome_index=req.outcomeIndex,
            side=req.side,
            size=req.size,
            limit_price=req.limitPrice,
            ttl_seconds=req.ttlSeconds,
            max_slippage_bps=req.maxSlippageBps,
            dry_run=True,
        )

        # Attach a mock transaction hash if none provided
        resp = result.get("response", {}) if isinstance(result, dict) else {}
        if not resp.get("tradeTxHash"):
            resp["tradeTxHash"] = f"0xmock-{uuid.uuid4().hex}"
            result["response"] = resp

        return result
    except Exception as e:
        print(f"[api/execute-order] error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
