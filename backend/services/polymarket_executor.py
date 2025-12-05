import json
import os
import time
import uuid
from typing import List, Tuple, Optional

import requests
from eth_account import Account
from eth_account.messages import encode_structured_data
from hexbytes import HexBytes
from web3 import Web3

# Defaults / configuration
DEFAULT_CLOB_URL = os.getenv("POLYMARKET_CLOB_URL", "https://clob.polymarket.com")
# Gamma is no longer used; all metadata comes from CLOB /markets.
DEFAULT_TTL = int(os.getenv("ORDER_TTL_SECONDS", "600"))
DEFAULT_SLIPPAGE_BPS = int(os.getenv("MAX_SLIPPAGE_BPS", "100"))
DEFAULT_MAX_ORDER_USDC = float(os.getenv("MAX_ORDER_USDC", "500"))
CHAIN_ID = int(os.getenv("POLYMARKET_CHAIN_ID", "137"))  # default Polygon; set 8453 for Base
ALLOW_MISSING_BOOK = os.getenv("ALLOW_MISSING_BOOK", "false").lower() == "true"


def fail(msg: str):
    print(f"[polymarket_executor] ERROR: {msg}")
    raise ValueError(msg)


def _find_market_by_condition_id(clob_url: str, condition_id: str) -> dict:
    """
    Resolve a market by condition_id/id/question_id.
    Fast path: try CLOB /markets/{id}. If not found, paginate /markets.
    """
    print(f"[polymarket_executor] searching CLOB markets for condition_id={condition_id}")
    condition_id = condition_id.lower()

    # Fast path: try /markets/{id}
    try:
        resp = requests.get(f"{clob_url}/markets/{condition_id}", timeout=15)
        if resp.ok:
            m = resp.json()
            cid = (m.get("condition_id") or "").lower()
            mid = (m.get("id") or "").lower()
            qid = (m.get("question_id") or "").lower()
            if condition_id in {cid, mid, qid}:
                print("[polymarket_executor] matched via /markets/{id}")
                return m
    except Exception as e:
        print(f"[polymarket_executor] /markets/{{id}} lookup failed: {e}")
    next_cursor = ""

    while True:
        print(f"[polymarket_executor] fetching markets page cursor='{next_cursor}'")
        resp = requests.get(
            f"{clob_url}/markets",
            params={"next_cursor": next_cursor},
            timeout=30,
        )
        if not resp.ok:
            fail(f"CLOB markets fetch failed {resp.status_code}: {resp.text[:200]}")
        payload = resp.json()
        print(f"[polymarket_executor] markets page keys={list(payload.keys())} next_cursor={payload.get('next_cursor')}")

        # Expected shape: { limit, count, next_cursor, data: [ Market, ... ] }
        markets = payload.get("data") or []
        print(f"[polymarket_executor] markets page count={len(markets)}")
        for m in markets:
            cid = (m.get("condition_id") or "").lower()
            mid = (m.get("id") or "").lower()
            qid = (m.get("question_id") or "").lower()
            if cid == condition_id or mid == condition_id or qid == condition_id:
                print("[polymarket_executor] matched market by id/condition_id/question_id")
                return m

        nc = payload.get("next_cursor")
        # Per docs: empty string = start, 'LTE=' means end sentinel. :contentReference[oaicite:2]{index=2}
        if not nc or nc == "LTE=":
            break
        next_cursor = nc

    fail(f"No CLOB market found with condition_id {condition_id}")


def get_token_info(
    clob_url: str,
    market_id: str,
    outcome_index: int,
) -> Tuple[str, List[str], List[dict], str]:
    """
    Resolve a CLOB condition_id (your marketId) to:
      - token_id for the selected outcome (by outcome_index)
      - list of human-readable outcomes for logging / UI

    Uses /markets from the CLOB API, which returns:
      { condition_id, question_id, tokens: [{token_id, outcome, ...}, ...], ... } :contentReference[oaicite:3]{index=3}
    """
    print(f"[polymarket_executor] get_token_info market_id={market_id} outcome_index={outcome_index}")
    market = _find_market_by_condition_id(clob_url, market_id)
    tokens = market.get("tokens") or []
    if not tokens:
        fail("No tokens in CLOB market response")

    print(f"[polymarket_executor] tokens_count={len(tokens)}")
    if outcome_index < 0 or outcome_index >= len(tokens):
        fail(f"Outcome index {outcome_index} out of range (len {len(tokens)})")

    outcomes = [t.get("outcome") or f"outcome_{i}" for i, t in enumerate(tokens)]
    chosen = tokens[outcome_index]
    token_id = chosen.get("token_id")
    if not token_id:
        fail("Missing token_id for selected outcome")

    print(
        f"[polymarket_executor] resolved condition_id={market_id} "
        f"to token_id={token_id} outcomes={outcomes}"
    )
    market_id_for_book = market.get("id") or market_id
    return token_id, outcomes, tokens, market_id_for_book


def get_orderbook(
    clob_url: str,
    token_id: str,
    condition_id: Optional[str] = None,
    tokens: Optional[List[dict]] = None,
    desired_outcome_index: Optional[int] = None,
    market_id_for_book: Optional[str] = None,
) -> Tuple[List[Tuple[float, float]], List[Tuple[float, float]]]:
    """
    Fetch the orderbook. Primary: /book?token_id. Fallback: /book?market=<condition_id>.

    Docs: GET /book?token_id=<string>, where token_id is the ERC1155 outcome token id. :contentReference[oaicite:4]{index=4}
    """
    print(f"[polymarket_executor] fetching orderbook from {clob_url} for token_id={token_id}")
    url = f"{clob_url}/book"

    tried_tokens = []

    def _fetch_by_token(tid: str):
        r = requests.get(url, params={"token_id": tid}, timeout=30)
        return r

    # Try requested token_id first
    resp = _fetch_by_token(token_id)
    tried_tokens.append(token_id)
    if resp.ok:
        data = resp.json()
        bids = [(float(b["price"]), float(b["size"])) for b in data.get("bids", [])]
        asks = [(float(a["price"]), float(a["size"])) for a in data.get("asks", [])]
        return bids, asks

    print(
        f"[polymarket_executor] token_id book failed status={resp.status_code} body={resp.text[:200]}"
    )

    # If we have tokens list, try other outcomes to see if any book exists
    if tokens:
        for idx, t in enumerate(tokens):
            tid = t.get("token_id")
            if not tid or tid in tried_tokens:
                continue
            print(f"[polymarket_executor] trying alternate token_id index={idx} id={tid}")
            resp_alt = _fetch_by_token(tid)
            if resp_alt.ok:
                data = resp_alt.json()
                bids = [(float(b["price"]), float(b["size"])) for b in data.get("bids", [])]
                asks = [(float(a["price"]), float(a["size"])) for a in data.get("asks", [])]
                if desired_outcome_index is not None and idx != desired_outcome_index:
                    print(
                        f"[polymarket_executor] WARNING: found book on different outcome index={idx}"
                    )
                return bids, asks
            else:
                print(
                    f"[polymarket_executor] alternate token failed status={resp_alt.status_code} body={resp_alt.text[:200]}"
                )

    # If no token-level books found, report clearly
    market_param = market_id_for_book or condition_id or "unknown"
    fail(
        f"No orderbook available for token {token_id} (market={market_param}); "
        "likely no liquidity or wrong chain/token."
    )


def pick_price(
    side: str,
    limit_price: float,
    bids: List[Tuple[float, float]],
    asks: List[Tuple[float, float]],
    max_slippage_bps: int,
) -> float:
    print(
        f"[polymarket_executor] pick_price side={side} "
        f"limit={limit_price} slippage_bps={max_slippage_bps}"
    )
    best = asks[0][0] if side == "buy" and asks else (bids[0][0] if side == "sell" and bids else None)
    if best is None:
        print("[polymarket_executor] no best price in book; using provided limit")
        return limit_price

    allowed = best * (1 + max_slippage_bps / 10000) if side == "buy" else best * (1 - max_slippage_bps / 10000)
    if side == "buy" and limit_price > allowed:
        fail(f"Buy price {limit_price} exceeds slippage guard {allowed}")
    if side == "sell" and limit_price < allowed:
        fail(f"Sell price {limit_price} below slippage guard {allowed}")
    return limit_price


def to_base_units(amount: float) -> str:
    # Prices and sizes are 6-decimals fixed-point strings. :contentReference[oaicite:5]{index=5}
    return str(int(round(amount * 1_000_000)))


def build_order_body(
    maker: str,
    token_id: str,
    side: str,
    price: float,
    size: float,
    ttl_seconds: int,
) -> dict:
    print(
        f"[polymarket_executor] build_order_body maker={maker} token_id={token_id} "
        f"side={side} price={price} size={size} ttl={ttl_seconds}"
    )
    now = int(time.time())
    expiration = now + ttl_seconds
    return {
        "token_id": token_id,
        "side": 0 if side == "buy" else 1,
        "price": to_base_units(price),
        "size": to_base_units(size),
        "expiration": expiration,
        "salt": uuid.uuid4().hex,
        "feeRateBps": 0,
        "maker": maker,
        "chainId": CHAIN_ID,
    }


def sign_order(
    order_body: dict,
    private_key: str,
    domain_name: str,
    domain_version: str,
    verifier: str,
) -> str:
    print("[polymarket_executor] signing order...")
    print(
        f"[polymarket_executor] domain name={domain_name} "
        f"version={domain_version} verifier={verifier}"
    )

    domain = {
        "name": domain_name,
        "version": domain_version,
        "chainId": CHAIN_ID,
        "verifyingContract": Web3.to_checksum_address(verifier),
    }

    types = {
        "EIP712Domain": [
            {"name": "name", "type": "string"},
            {"name": "version", "type": "string"},
            {"name": "chainId", "type": "uint256"},
            {"name": "verifyingContract", "type": "address"},
        ],
        "Order": [
            {"name": "maker", "type": "address"},
            {"name": "taker", "type": "address"},
            {"name": "tokenId", "type": "uint256"},
            {"name": "price", "type": "uint256"},
            {"name": "amount", "type": "uint256"},
            {"name": "expiration", "type": "uint256"},
            {"name": "salt", "type": "bytes32"},
            {"name": "side", "type": "uint8"},
            {"name": "feeRateBps", "type": "uint256"},
        ],
    }

    message = {
        "maker": Web3.to_checksum_address(order_body["maker"]),
        "taker": "0x0000000000000000000000000000000000000000",
        "tokenId": int(order_body["token_id"]),
        "price": int(order_body["price"]),
        "amount": int(order_body["size"]),
        "expiration": int(order_body["expiration"]),
        "salt": HexBytes("0x" + order_body["salt"]),
        "side": int(order_body["side"]),
        "feeRateBps": int(order_body["feeRateBps"]),
    }

    structured_data = {
        "types": types,
        "domain": domain,
        "primaryType": "Order",
        "message": message,
    }

    signable = encode_structured_data(structured_data)
    signed = Account.sign_message(signable, private_key=private_key)
    return signed.signature.hex()


def submit_order(
    clob_url: str,
    order_body: dict,
    signature: str,
    dry_run: bool,
) -> dict:
    print(f"[polymarket_executor] submitting order dry_run={dry_run} clob_url={clob_url}")
    payload = {**order_body, "signature": signature}
    if dry_run:
        return {"dryRun": True, "payload": payload}
    resp = requests.post(f"{clob_url}/orders", json=payload, timeout=30)
    if not resp.ok:
        fail(f"Order submit failed {resp.status_code}: {resp.text[:400]}")
    return resp.json()


def execute_order(
    market_id: str,
    outcome_index: int,
    side: str,
    size: float,
    limit_price: float,
    ttl_seconds: Optional[int] = None,
    max_slippage_bps: Optional[int] = None,
    dry_run: bool = True,
    token_id: Optional[str] = None,
) -> dict:
    """
    Server-side execution path:
      1) Resolve conditionId (market_id) -> CLOB tokenId + outcomes via CLOB /markets
      2) Fetch orderbook for that token via /book?token_id=...
      3) Build + sign EIP712 order
      4) Submit to CLOB /orders
    """
    polygon_rpc = os.getenv("POLYMARKET_RPC_URL") or os.getenv("POLYGON_RPC_URL")
    pk = os.getenv("POLYMARKET_PRIVATE_KEY")
    clob_url = DEFAULT_CLOB_URL
    domain_name = os.getenv("POLYMARKET_EIP712_NAME")
    domain_version = os.getenv("POLYMARKET_EIP712_VERSION")
    verifier = os.getenv("POLYMARKET_VERIFIER")

    print(
        f"[polymarket_executor] execute_order start market={market_id} "
        f"outcome={outcome_index} side={side} size={size} "
        f"limit={limit_price} ttl={ttl_seconds} dry_run={dry_run}"
    )
    print(f"[polymarket_executor] env POLYMARKET_RPC_URL/POLYGON_RPC_URL set={bool(polygon_rpc)}")
    print(f"[polymarket_executor] env POLYMARKET_PRIVATE_KEY set={bool(pk)}")
    print(
        f"[polymarket_executor] env domain_name={domain_name} "
        f"domain_version={domain_version} verifier={verifier} chainId={CHAIN_ID}"
    )

    if not polygon_rpc:
        fail("POLYGON_RPC_URL is required")
    if not pk:
        fail("POLYMARKET_PRIVATE_KEY is required")
    if not (domain_name and domain_version and verifier):
        fail("POLYMARKET_EIP712_NAME, POLYMARKET_EIP712_VERSION, POLYMARKET_VERIFIER are required for signing")

    notional = size * limit_price
    if notional > DEFAULT_MAX_ORDER_USDC:
        fail(f"Order notional {notional} exceeds cap {DEFAULT_MAX_ORDER_USDC} (MAX_ORDER_USDC)")

    account = Account.from_key(pk)
    maker = account.address
    print(f"[polymarket_executor] maker address={maker}")

    # 1) Resolve token_id
    if token_id:
        print(f"[polymarket_executor] using provided token_id={token_id}")
        market_id_for_book = market_id
        outcomes = []
        tokens = None
    else:
        token_id, outcomes, tokens, market_id_for_book = get_token_info(clob_url, market_id, outcome_index)

    # 2) orderbook for that token (try alternates if book missing)
    try:
        bids, asks = get_orderbook(
            clob_url,
            token_id,
            market_id,
            tokens=tokens,
            desired_outcome_index=outcome_index,
            market_id_for_book=market_id_for_book,
        )
    except Exception as e:
        if dry_run and ALLOW_MISSING_BOOK:
            print(
                f"[polymarket_executor] orderbook unavailable, but ALLOW_MISSING_BOOK=true & dry_run -> using empty book; error: {e}"
            )
            bids, asks = [], []
        else:
            raise
    print(
        f"[polymarket_executor] orderbook top bid={bids[0] if bids else None} "
        f"top ask={asks[0] if asks else None}"
    )
    price = pick_price(side, limit_price, bids, asks, max_slippage_bps or DEFAULT_SLIPPAGE_BPS)

    # 3) build + sign
    order_body = build_order_body(
        maker=maker,
        token_id=token_id,
        side=side,
        price=price,
        size=size,
        ttl_seconds=ttl_seconds or DEFAULT_TTL,
    )

    signature = sign_order(order_body, pk, domain_name, domain_version, verifier)
    print(f"[polymarket_executor] signature={signature[:10]}...")
    result = submit_order(clob_url, order_body, signature, dry_run)
    print(f"[polymarket_executor] submit result: {json.dumps(result)[:400]}")

    # Include helpful debugging info
    return {
        "maker": maker,
        "marketId": market_id,
        "tokenId": token_id,
        "outcomeIndex": outcome_index,
        "side": side,
        "size": size,
        "limitPrice": limit_price,
        "usedPrice": price,
        "outcomes": outcomes,
        "orderBody": order_body,
        "signature": signature,
        "response": result,
    }
