from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.polymarket import get_orderbook, submit_order
from eth_account import Account
from eth_account.messages import encode_defunct
import json
from datetime import datetime, timezone

router = APIRouter()

class ExecuteHedgeRequest(BaseModel):
    marketId: str
    outcomeIndex: int  # 0 for Yes, 1 for No
    usdcAmount: float
    price: Optional[float] = None  # Optional limit price

class OrderData(BaseModel):
    typedData: dict
    message: str

class SubmitOrderRequest(BaseModel):
    signedOrder: dict

def create_eip712_order(
    market_id: str,
    outcome_index: int,
    amount: float,
    price: Optional[float] = None,
    user_address: str = "0x0000000000000000000000000000000000000000"
) -> dict:
    """
    Create EIP-712 typed data for Polymarket order.
    
    IMPORTANT: This is a simplified version. The actual Polymarket CLOB API uses
    a specific EIP-712 schema. You must adjust this to match Polymarket's exact
    order structure. Check Polymarket API documentation for:
    - Exact domain separator
    - Order type definitions
    - Required fields
    - Chain ID (Base = 8453)
    
    Reference: https://docs.polymarket.com/
    """
    # Convert USDC amount (6 decimals) to wei-like units
    amount_wei = int(amount * 1e6)
    
    # Get current timestamp
    timestamp = int(datetime.now(timezone.utc).timestamp())
    
    # Polymarket CLOB order structure (simplified)
    # Note: Actual implementation should match Polymarket's exact EIP-712 schema
    order_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            "Order": [
                {"name": "market", "type": "string"},
                {"name": "side", "type": "string"},
                {"name": "outcome", "type": "string"},
                {"name": "amount", "type": "uint256"},
                {"name": "price", "type": "uint256"},
                {"name": "timestamp", "type": "uint256"}
            ]
        },
        "primaryType": "Order",
        "domain": {
            "name": "Polymarket",
            "version": "1",
            "chainId": 8453,  # Base mainnet
            "verifyingContract": "0x0000000000000000000000000000000000000000"  # Placeholder
        },
        "message": {
            "market": market_id,
            "side": "buy" if outcome_index == 0 else "sell",
            "outcome": "YES" if outcome_index == 0 else "NO",
            "amount": amount_wei,
            "price": int((price or 0.5) * 1e18),  # Price in 18 decimals
            "timestamp": timestamp
        }
    }
    
    return order_data

@router.post("/execute-hedge")
async def execute_hedge_endpoint(request: ExecuteHedgeRequest):
    """
    Create EIP-712 order data for user to sign.
    Returns typed data that frontend should sign with user's wallet.
    """
    try:
        # Get orderbook to determine best price if not provided
        if request.price is None:
            orderbook = get_orderbook(request.marketId)
            if orderbook:
                # Use mid-price from orderbook
                # This is simplified - actual implementation should parse orderbook properly
                request.price = 0.5  # Default to 50% if orderbook parsing fails
        
        # Create EIP-712 order
        typed_data = create_eip712_order(
            market_id=request.marketId,
            outcome_index=request.outcomeIndex,
            amount=request.usdcAmount,
            price=request.price
        )
        
        return {
            "typedData": typed_data,
            "message": "Sign this order with your wallet to execute the hedge"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating order: {str(e)}")

@router.post("/submit-order")
async def submit_order_endpoint(request: SubmitOrderRequest):
    """
    Submit a signed order to Polymarket CLOB API.
    Returns trade transaction hash.
    """
    try:
        result = submit_order(request.signedOrder)
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to submit order to Polymarket")
        
        # Extract transaction hash from response
        # Actual response structure depends on Polymarket API
        trade_tx_hash = result.get("txHash") or result.get("transactionHash") or result.get("id", "")
        
        return {
            "tradeTxHash": trade_tx_hash,
            "status": "success",
            "polymarketResponse": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting order: {str(e)}")

