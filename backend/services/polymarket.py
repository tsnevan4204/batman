import requests
import json
import os
from typing import List, Dict, Optional

# Note: Polymarket API endpoints may need adjustment based on actual API documentation
# Check https://docs.polymarket.com/ for the latest API structure
# Using Gamma API for comprehensive market data (all prediction markets)
GAMMA_API_BASE = "https://gamma-api.polymarket.com"
CLOB_API_BASE = "https://clob.polymarket.com"

def search_events(query: str, limit_per_type: int = 200) -> Dict:
    """
    Call Polymarket public-search to fetch events and markets for a query.
    """
    url = f"{GAMMA_API_BASE}/public-search"
    params = {"q": query, "limit_per_type": limit_per_type}
    print(f"[POLYMARKET] Searching events with query='{query}' limit={limit_per_type}")
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        events_count = len(data.get("events", [])) if isinstance(data, dict) else 0
        print(f"[POLYMARKET] /public-search returned {events_count} events")
        return data
    except Exception as e:
        print(f"[POLYMARKET] ERROR during /public-search: {e}")
        import traceback
        print(f"[POLYMARKET] Traceback: {traceback.format_exc()}")
        return {"events": [], "pagination": {"hasMore": False, "totalResults": 0}}

def fetch_markets() -> List[Dict]:
    """
    Fetch all active markets from Polymarket Gamma API (and optionally merge with CLOB).
    Gamma API provides comprehensive market data including all prediction markets.
    Returns list of market dictionaries.
    """
    print("\n" + "="*80)
    print("[POLYMARKET] Starting market fetch from Gamma API...")
    print(f"[POLYMARKET] Gamma API Base: {GAMMA_API_BASE}")
    print(f"[POLYMARKET] CLOB API Base: {CLOB_API_BASE}")
    
    all_markets = []
    
    try:
        # Primary source: Gamma API (comprehensive market data)
        gamma_url = f"{GAMMA_API_BASE}/events"
        print(f"[POLYMARKET] Fetching from Gamma API: {gamma_url}")
        
        try:
            response = requests.get(gamma_url, timeout=60, params={"active": "true"})
            response.raise_for_status()

            raw_data = response.json()
            print(f"[POLYMARKET] Gamma API response type: {type(raw_data)}")

            # Handle different response structures
            if isinstance(raw_data, dict):
                print(f"[POLYMARKET] Gamma response keys: {list(raw_data.keys())}")
                if "data" in raw_data:
                    markets = raw_data["data"]
                    print(f"[POLYMARKET] Found 'data' key with {len(markets)} markets")
                elif "results" in raw_data:
                    markets = raw_data["results"]
                    print(f"[POLYMARKET] Found 'results' key with {len(markets)} markets")
                elif "markets" in raw_data:
                    markets = raw_data["markets"]
                    print(f"[POLYMARKET] Found 'markets' key with {len(markets)} markets")
                else:
                    markets = [raw_data] if raw_data else []
                    print(f"[POLYMARKET] No known key found, treating as single market or empty")
            elif isinstance(raw_data, list):
                markets = raw_data
                print(f"[POLYMARKET] Gamma response is a list with {len(markets)} markets")
            else:
                print(f"[POLYMARKET] Unexpected Gamma response type: {type(raw_data)}")
                markets = []

            if markets:
                all_markets.extend(markets)
                print(f"[POLYMARKET] Added {len(markets)} markets from Gamma API")
        except Exception as e:
            print(f"[POLYMARKET] Error fetching from Gamma API: {e}")
            import traceback
            print(f"[POLYMARKET] Traceback: {traceback.format_exc()}")
        
        # Optional: Merge with CLOB markets for trading liquidity info
        clob_url = f"{CLOB_API_BASE}/markets"
        print(f"[POLYMARKET] Optionally fetching from CLOB API: {clob_url}")
        
        try:
            clob_response = requests.get(clob_url, timeout=30)
            clob_response.raise_for_status()

            clob_data = clob_response.json()
            print(f"[POLYMARKET] CLOB API response type: {type(clob_data)}")

            if isinstance(clob_data, dict) and "data" in clob_data:
                clob_markets = clob_data["data"]
            elif isinstance(clob_data, list):
                clob_markets = clob_data
            else:
                clob_markets = []

            if clob_markets:
                print(f"[POLYMARKET] Found {len(clob_markets)} CLOB markets for merging")
                # Merge CLOB markets (they may have liquidity/orderbook info)
                all_markets.extend(clob_markets)
        except Exception as e:
            print(f"[POLYMARKET] Error fetching from CLOB API (non-critical): {e}")
            # CLOB fetch failure is not critical, continue with Gamma markets
        
        # Deduplicate markets by ID (try multiple ID fields)
        print(f"[POLYMARKET] Total markets before deduplication: {len(all_markets)}")
        unique_markets = {}
        for market in all_markets:
            market_id = market.get("id") or market.get("market_id") or market.get("condition_id") or market.get("question_id")
            if market_id:
                unique_markets[market_id] = market
        
        markets = list(unique_markets.values())
        print(f"[POLYMARKET] After deduplication: {len(markets)} unique markets")
        
        if markets:
            # Analyze market structure
            sample = markets[0]
            print(f"[POLYMARKET] Sample market keys: {list(sample.keys())}")
            print(f"[POLYMARKET] Sample market question: {sample.get('question', 'N/A')[:100]}")
            
            # IMPORTANT: Do NOT filter on active/closed/archived fields!
            # - "closed" means AMM is closed, NOT that CLOB trading is unavailable
            # - Markets can be tradeable even if marked "closed" before resolution
            # - Let the matching algorithm pick the best markets instead
            
            print(f"[POLYMARKET] Total markets available: {len(markets)}")
            print(f"[POLYMARKET] Note: Not filtering on active/closed/archived - all markets are candidates for matching")
            
            # Filter out pure sports markets (optional - they dominate but aren't useful for business hedging)
            sports_keywords = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'soccer', 'football', 'basketball', 
                             'baseball', 'hockey', 'tennis', 'golf', 'boxing', 'UFC', 'MMA', 'match', 'game', 
                             'vs.', 'versus', 'championship', 'playoff', 'super bowl', 'world series', 'nfl', 
                             'nba', 'mlb', 'nhl', 'ncaab', 'ncaaf']
            
            business_markets = []
            sports_markets = []
            
            for m in markets:
                question = m.get('question', m.get('title', '')).lower()
                description = m.get('description', '').lower()
                category = m.get('category', '').lower()
                tags = ' '.join(m.get('tags', [])).lower() if isinstance(m.get('tags'), list) else ''
                
                # Check question, description, category, and tags for sports keywords
                text = f"{question} {description} {category} {tags}"
                
                # Check if it's a sports market
                is_sports = any(keyword.lower() in text for keyword in sports_keywords)
                
                if is_sports:
                    sports_markets.append(m)
                else:
                    business_markets.append(m)
            
            print(f"[POLYMARKET] Market breakdown:")
            print(f"  - Business/Other markets: {len(business_markets)}")
            print(f"  - Sports markets (filtered out): {len(sports_markets)}")
            
            if business_markets:
                # Show sample of business market types
                sample_types = {}
                for m in business_markets[:30]:
                    question = m.get('question', m.get('title', ''))[:80]
                    q_lower = question.lower()
                    if 'election' in q_lower or 'president' in q_lower or 'vote' in q_lower:
                        sample_types['Politics'] = sample_types.get('Politics', 0) + 1
                    elif 'rain' in q_lower or 'weather' in q_lower or 'temperature' in q_lower or 'climate' in q_lower:
                        sample_types['Weather/Climate'] = sample_types.get('Weather/Climate', 0) + 1
                    elif 'crypto' in q_lower or 'bitcoin' in q_lower or 'ethereum' in q_lower:
                        sample_types['Crypto'] = sample_types.get('Crypto', 0) + 1
                    elif 'oil' in q_lower or 'gas' in q_lower or 'commodity' in q_lower or 'price' in q_lower:
                        sample_types['Commodities/Economics'] = sample_types.get('Commodities/Economics', 0) + 1
                    elif 'shipping' in q_lower or 'freight' in q_lower or 'transport' in q_lower:
                        sample_types['Shipping/Logistics'] = sample_types.get('Shipping/Logistics', 0) + 1
                    else:
                        sample_types['Other'] = sample_types.get('Other', 0) + 1
                
                print(f"[POLYMARKET] Business market categories (first 30): {sample_types}")
                print(f"[POLYMARKET] Sample business markets:")
                for i, m in enumerate(business_markets[:5], 1):
                    q = m.get('question', m.get('title', 'Unknown'))[:70]
                    print(f"  {i}. {q}")
            
            markets = business_markets  # Use only non-sports markets
        else:
            print("[POLYMARKET] WARNING: No markets found after processing")
            markets = []
        
        # Save to markets.json
        markets_file = os.path.join(os.path.dirname(__file__), "..", "markets.json")
        with open(markets_file, "w") as f:
            json.dump(markets, f, indent=2)
        
        print(f"[POLYMARKET] Saved {len(markets)} markets to markets.json")
        print("="*80 + "\n")
        return markets
    except Exception as e:
        print(f"[POLYMARKET] ERROR fetching markets: {e}")
        import traceback
        print(f"[POLYMARKET] Traceback: {traceback.format_exc()}")
        # Try to load from cache if API fails
        markets_file = os.path.join(os.path.dirname(__file__), "..", "markets.json")
        if os.path.exists(markets_file):
            print(f"[POLYMARKET] Attempting to load from cache: {markets_file}")
            with open(markets_file, "r") as f:
                cached = json.load(f)
                # Handle nested structure in cache too
                if isinstance(cached, dict) and "data" in cached:
                    cached = cached["data"]
                print(f"[POLYMARKET] Loaded {len(cached)} markets from cache")
                return cached
        print("[POLYMARKET] No cache available, returning empty list")
        return []

def load_markets() -> List[Dict]:
    """Load markets from local markets.json file."""
    print("\n[POLYMARKET] Loading markets from cache...")
    markets_file = os.path.join(os.path.dirname(__file__), "..", "markets.json")
    if os.path.exists(markets_file):
        with open(markets_file, "r") as f:
            raw_data = json.load(f)
            print(f"[POLYMARKET] Loaded data from {markets_file}")
            print(f"[POLYMARKET] Raw data type: {type(raw_data)}")
            
            # Handle nested structure
            if isinstance(raw_data, dict):
                if "data" in raw_data:
                    markets = raw_data["data"]
                    print(f"[POLYMARKET] Extracted {len(markets)} markets from 'data' key")
                else:
                    markets = [raw_data] if raw_data else []
                    print(f"[POLYMARKET] No 'data' key, treating as single market or empty")
            elif isinstance(raw_data, list):
                markets = raw_data
                print(f"[POLYMARKET] Data is a list with {len(markets)} markets")
            else:
                print(f"[POLYMARKET] Unexpected data type: {type(raw_data)}")
                markets = []
            
            if markets:
                # Note: We do NOT filter on active/closed/archived - all markets are candidates
                print(f"[POLYMARKET] Total markets in cache: {len(markets)}")
                
                # Filter out sports markets (optional - same logic as fetch_markets)
                sports_keywords = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'soccer', 'football', 'basketball', 
                                 'baseball', 'hockey', 'tennis', 'golf', 'boxing', 'UFC', 'MMA', 'match', 'game', 
                                 'vs.', 'versus', 'championship', 'playoff', 'super bowl', 'world series']
                
                business_markets = []
                for m in markets:
                    question = m.get('question', m.get('title', '')).lower()
                    description = m.get('description', '').lower()
                    category = m.get('category', '').lower()
                    tags = ' '.join(m.get('tags', [])).lower() if isinstance(m.get('tags'), list) else ''
                    text = f"{question} {description} {category} {tags}"
                    is_sports = any(keyword.lower() in text for keyword in sports_keywords)
                    if not is_sports:
                        business_markets.append(m)
                
                print(f"[POLYMARKET] Business markets after sports filter: {len(business_markets)}/{len(markets)}")
                
                if business_markets:
                    # Show sample categories
                    sample_questions = [m.get('question', m.get('title', ''))[:50] for m in business_markets[:10]]
                    print(f"[POLYMARKET] Sample business market questions:")
                    for i, q in enumerate(sample_questions, 1):
                        print(f"  {i}. {q}")
                
                return business_markets  # Return only active non-sports markets
            
            return markets
    print("[POLYMARKET] No cache file found")
    return []

def get_market_by_id(market_id: str) -> Optional[Dict]:
    """
    Get market details by ID from Gamma API.
    Useful for looking up token_id for a given marketId + outcomeIndex.
    """
    try:
        url = f"{GAMMA_API_BASE}/markets/{market_id}"
        print(f"[POLYMARKET] Fetching market details for {market_id} from Gamma API")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        market_data = response.json()
        print(f"[POLYMARKET] Retrieved market data for {market_id}")
        return market_data
    except Exception as e:
        print(f"[POLYMARKET] Error fetching market {market_id} from Gamma: {e}")
        return None

def get_token_id(market_id: str, outcome_index: int) -> Optional[str]:
    """
    Get token_id for a market and outcome index.
    Looks up market from Gamma API and extracts token_id from tokens array.
    """
    try:
        market = get_market_by_id(market_id)
        if not market:
            # Try CLOB API as fallback
            print(f"[POLYMARKET] Trying CLOB API for market {market_id}")
            clob_url = f"{CLOB_API_BASE}/markets"
            response = requests.get(clob_url, params={"market": market_id}, timeout=30)
            if response.status_code == 200:
                clob_data = response.json()
                if isinstance(clob_data, dict) and "data" in clob_data:
                    markets = clob_data["data"]
                    market = next((m for m in markets if m.get("id") == market_id or m.get("condition_id") == market_id), None)
                elif isinstance(clob_data, list):
                    market = next((m for m in clob_data if m.get("id") == market_id or m.get("condition_id") == market_id), None)
        
        if market and "tokens" in market:
            tokens = market["tokens"]
            if isinstance(tokens, list) and outcome_index < len(tokens):
                token_id = tokens[outcome_index].get("token_id") or tokens[outcome_index].get("id")
                print(f"[POLYMARKET] Found token_id {token_id} for market {market_id}, outcome {outcome_index}")
                return token_id
        
        print(f"[POLYMARKET] Could not find token_id for market {market_id}, outcome {outcome_index}")
        return None
    except Exception as e:
        print(f"[POLYMARKET] Error getting token_id: {e}")
        import traceback
        print(f"[POLYMARKET] Traceback: {traceback.format_exc()}")
        return None

def get_orderbook(market_id: str) -> Optional[Dict]:
    """
    Fetch orderbook for a specific market from CLOB API.
    """
    try:
        url = f"{CLOB_API_BASE}/book"
        params = {"market": market_id}
        print(f"[POLYMARKET] Fetching orderbook for {market_id}")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[POLYMARKET] Error fetching orderbook for {market_id}: {e}")
        return None

def submit_order(signed_order: Dict) -> Optional[Dict]:
    """
    Submit a signed order to Polymarket CLOB API.
    Returns the trade transaction hash if successful.
    Note: Order should be EIP-712 signed and include token_id.
    """
    try:
        url = f"{CLOB_API_BASE}/orders"
        headers = {
            "Content-Type": "application/json",
        }
        print(f"[POLYMARKET] Submitting order to CLOB API: {url}")
        print(f"[POLYMARKET] Order data: {json.dumps(signed_order, indent=2)[:500]}...")
        response = requests.post(url, json=signed_order, headers=headers, timeout=30)
        response.raise_for_status()
        result = response.json()
        print(f"[POLYMARKET] Order submitted successfully")
        return result
    except Exception as e:
        print(f"[POLYMARKET] Error submitting order: {e}")
        if 'response' in locals():
            print(f"[POLYMARKET] Response status: {response.status_code}")
            print(f"[POLYMARKET] Response text: {response.text[:500]}")
        return None

def build_market_text(market: Dict) -> str:
    """
    Build a text representation of a market for embedding.
    Combines title, question, description, category, and metadata.
    Enhanced with location, time horizon, and units for better matching.
    """
    parts = []
    
    # Core content
    if "question" in market:
        parts.append(market["question"])
    if "title" in market and market.get("title") != market.get("question"):
        parts.append(market["title"])
    if "description" in market:
        parts.append(market["description"])
    
    # Category/tags
    if "category" in market:
        parts.append(f"Category: {market['category']}")
    if "tags" in market and isinstance(market["tags"], list):
        parts.append(f"Tags: {', '.join(market['tags'])}")
    
    # Metadata for better matching
    metadata_parts = []
    
    # Location if available
    if "location" in market:
        metadata_parts.append(f"Location: {market['location']}")
    
    # Time horizon
    if "end_date_iso" in market or "end_date" in market:
        end_date = market.get("end_date_iso") or market.get("end_date")
        metadata_parts.append(f"End date: {end_date}")
    
    # Outcome/token information
    if "tokens" in market and isinstance(market["tokens"], list):
        outcomes = [t.get("outcome", "") for t in market["tokens"] if t.get("outcome")]
        if outcomes:
            metadata_parts.append(f"Outcomes: {', '.join(outcomes)}")
    
    # Add metadata if present
    if metadata_parts:
        parts.append(" | ".join(metadata_parts))
    
    text = " ".join(parts)
    
    # Debug: log if text is empty or very short
    if len(text.strip()) < 10:
        print(f"[POLYMARKET] WARNING: Market has very short text ({len(text)} chars)")
        print(f"  Market keys: {list(market.keys())}")
        print(f"  Question: {market.get('question', 'N/A')[:100]}")
    
    return text

