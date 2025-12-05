# Polymarket Execution Plan (non-backend changes)

Goal: add a clear path to programmatically place hedges on Polymarket while leaving the existing Python backend untouched. This plan assumes Polygon mainnet and USDC collateral.

## Current pieces in repo (unchanged)
- Market discovery and ranking already live in `backend/services/polymarket.py` and `backend/services/matching_engine.py` (fetch markets, build text, similarity/LLM ranking). Execution/signing is not yet implemented.

## Proposed execution flow
1) Select market + outcome  
   - Use existing matching output to pick `marketId` and `outcome index`.  
   - Get the `token_id` via Gamma (`/markets/{id}`) or `get_token_id` helper.
2) Price + depth  
   - Pull orderbook from `https://clob.polymarket.com/book?market=<marketId>` to pick limit price and confirm size fits available liquidity.
3) Sizing  
   - Decide notional in USDC (6 decimals). Convert to base units required by the CLOB library; keep per-order and per-market risk caps.
4) Order build + sign (EIP-712)  
   - Build an order payload with: `token_id`, `side`, `size`, `price`, `expiration`, `salt`, `feeRateBps` (usually 0), `chainId=137`, `maker=<wallet>`.  
   - Sign with the funded wallet’s private key (never store it in code).  
   - Ensure `USDC` allowance to the Polymarket CLOB contract before submitting.
5) Submit + monitor  
   - POST the signed order to `https://clob.polymarket.com/orders`.  
   - Poll fills/cancels via the CLOB API or wallet events; retry with backoff on 429/5xx.

## Standalone executor (keeps backend Python untouched)
Create a separate Node CLI so merges do not touch the backend:
```
mkdir -p ops/polymarket-executor
cd ops/polymarket-executor
npm init -y
npm install @polymarket/clob-client @polymarket/order-utils ethers dotenv cross-fetch
```

Environment variables (place in `ops/polymarket-executor/.env`):
- `POLYMARKET_PRIVATE_KEY` — funded Polygon key that has USDC + allowance set.
- `POLYGON_RPC_URL` — e.g., https://polygon-rpc.com or Alchemy/Infura.
- `POLYMARKET_CLOB_URL` — default `https://clob.polymarket.com`.
- `POLYMARKET_GAMMA_URL` — default `https://gamma-api.polymarket.com`.
- Optional sizing guards: `MAX_ORDER_USDC`, `MAX_SLIPPAGE_BPS`, `ORDER_TTL_SECONDS`.

Suggested CLI shape (TypeScript/Node outline):
1) Load env + init `ethers` provider + wallet.  
2) Fetch target market, derive `tokenId` for the chosen outcome.  
3) Read orderbook, pick price/size within caps.  
4) Build order object (`token_id`, `side`, `size`, `price`, `expiration`, `salt`, `feeRateBps`, `maker`, `chainId`).  
5) Sign order with `@polymarket/order-utils` (EIP-712).  
6) Submit via `@polymarket/clob-client` `submitOrder` and log order id/tx hash.  
7) Poll status; exit non-zero on failure or partial fill if desired.

Risk/ops controls to bake in the CLI:
- Hard caps: per-order USDC, per-market daily notional, max open orders.
- Slippage guard: reject if best bid/ask deviates beyond `MAX_SLIPPAGE_BPS`.
- TTL: short expirations (e.g., 5–10 minutes) and auto-cancel stale orders.
- Network hygiene: retry with jitter on 429/5xx; avoid busy-looping the book.

Hand-off ideas to integrate later (once backend is free):
- Expose the CLI as a subprocess the backend can call with a JSON payload (marketId, outcome, side, size, limit).  
- Or migrate the same logic into a dedicated microservice; share the `.env` schema above.

Notes
- This document adds no backend Python changes per request.  
- Before live trading, dry-run against small sizes; confirm USDC allowance and gas settings on Polygon.

