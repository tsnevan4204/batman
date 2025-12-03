import requests
import json
import os
from typing import List, Dict, Optional

# Note: Polymarket API endpoints may need adjustment based on actual API documentation
# Check https://docs.polymarket.com/ for the latest API structure
POLYMARKET_API_BASE = "https://clob.polymarket.com"

def fetch_markets() -> List[Dict]:
    """
    Fetch all active markets from Polymarket API.
    Returns list of market dictionaries.
    
    Note: The actual endpoint structure may vary. Common alternatives:
    - https://clob.polymarket.com/markets
    - https://api.polymarket.com/markets
    - https://clob.polymarket.com/clob/markets
    """
    try:
        # Polymarket CLOB API endpoint for markets
        # Adjust endpoint based on actual Polymarket API documentation
        url = f"{POLYMARKET_API_BASE}/markets"
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        markets = response.json()
        
        # Save to markets.json
        markets_file = os.path.join(os.path.dirname(__file__), "..", "markets.json")
        with open(markets_file, "w") as f:
            json.dump(markets, f, indent=2)
        
        print(f"Fetched {len(markets)} markets and saved to markets.json")
        return markets
    except Exception as e:
        print(f"Error fetching markets: {e}")
        # Try to load from cache if API fails
        markets_file = os.path.join(os.path.dirname(__file__), "..", "markets.json")
        if os.path.exists(markets_file):
            with open(markets_file, "r") as f:
                return json.load(f)
        return []

def load_markets() -> List[Dict]:
    """Load markets from local markets.json file."""
    markets_file = os.path.join(os.path.dirname(__file__), "..", "markets.json")
    if os.path.exists(markets_file):
        with open(markets_file, "r") as f:
            return json.load(f)
    return []

def get_orderbook(market_id: str) -> Optional[Dict]:
    """
    Fetch orderbook for a specific market.
    """
    try:
        url = f"{POLYMARKET_API_BASE}/book"
        params = {"market": market_id}
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching orderbook for {market_id}: {e}")
        return None

def submit_order(signed_order: Dict) -> Optional[Dict]:
    """
    Submit a signed order to Polymarket CLOB API.
    Returns the trade transaction hash if successful.
    """
    try:
        url = f"{POLYMARKET_API_BASE}/orders"
        headers = {
            "Content-Type": "application/json",
        }
        response = requests.post(url, json=signed_order, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error submitting order: {e}")
        print(f"Response: {response.text if 'response' in locals() else 'No response'}")
        return None

def build_market_text(market: Dict) -> str:
    """
    Build a text representation of a market for embedding.
    Combines title, question, and category.
    """
    parts = []
    
    if "question" in market:
        parts.append(market["question"])
    if "title" in market:
        parts.append(market["title"])
    if "description" in market:
        parts.append(market["description"])
    if "category" in market:
        parts.append(f"Category: {market['category']}")
    
    return " ".join(parts)

