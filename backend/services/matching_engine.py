import os
import numpy as np
from typing import List, Dict
from openai import OpenAI
from services.polymarket import fetch_markets, load_markets, build_market_text

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def embed_text(text: str) -> List[float]:
    """Generate embedding for a text using OpenAI."""
    try:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None

def compute_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot_product / (norm1 * norm2)

def find_top_markets_by_similarity(
    risk_description: str,
    top_n: int = 15
) -> List[Dict]:
    """
    Find top N markets by embedding similarity.
    Returns list of markets with similarity scores.
    """
    # Fetch/load markets
    markets = fetch_markets()
    if not markets:
        markets = load_markets()
    
    if not markets:
        return []
    
    # Generate embedding for risk description
    risk_embedding = embed_text(risk_description)
    if not risk_embedding:
        return []
    
    # Generate embeddings for all markets and compute similarities
    market_similarities = []
    
    for market in markets:
        market_text = build_market_text(market)
        if not market_text:
            continue
        
        market_embedding = embed_text(market_text)
        if not market_embedding:
            continue
        
        similarity = compute_cosine_similarity(risk_embedding, market_embedding)
        market_similarities.append({
            "market": market,
            "similarity": similarity
        })
    
    # Sort by similarity and return top N
    market_similarities.sort(key=lambda x: x["similarity"], reverse=True)
    return market_similarities[:top_n]

def llm_rank_markets(
    risk_description: str,
    candidate_markets: List[Dict],
    top_k: int = 5
) -> List[Dict]:
    """
    Use LLM to rank candidate markets and return top K.
    """
    if not candidate_markets:
        return []
    
    # Build prompt for LLM
    market_descriptions = []
    for i, item in enumerate(candidate_markets):
        market = item["market"]
        market_id = market.get("id", market.get("market_id", f"market_{i}"))
        title = market.get("question", market.get("title", "Unknown"))
        description = market.get("description", "")
        
        market_descriptions.append(
            f"{i+1}. Market ID: {market_id}\n"
            f"   Title: {title}\n"
            f"   Description: {description[:200]}...\n"
        )
    
    prompt = f"""You are a risk hedging advisor. A business wants to hedge the following risk:

RISK DESCRIPTION:
{risk_description}

Here are candidate prediction markets from Polymarket that might be suitable for hedging this risk:

{chr(10).join(market_descriptions)}

Please rank these markets from most relevant to least relevant for hedging the described risk. Consider:
1. How directly the market outcome relates to the business risk
2. Whether hedging this market would effectively protect against the risk
3. The clarity and specificity of the market

Return ONLY a JSON array of market indices (1-indexed) in order of relevance, most relevant first. Format: [1, 3, 5, ...]

Example response: [2, 5, 1, 8, 3]
"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a risk hedging advisor. Return only valid JSON arrays."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=200
        )
        
        result_text = response.choices[0].message.content.strip()
        # Extract JSON array from response
        import re
        json_match = re.search(r'\[[\d,\s]+\]', result_text)
        if json_match:
            import json
            ranked_indices = json.loads(json_match.group())
            # Convert to 0-indexed and get top K
            ranked_indices = [idx - 1 for idx in ranked_indices[:top_k] if 0 <= idx - 1 < len(candidate_markets)]
            
            # Return ranked markets with additional metadata
            ranked_markets = []
            for idx in ranked_indices:
                market_item = candidate_markets[idx]
                market = market_item["market"]
                ranked_markets.append({
                    "marketId": market.get("id", market.get("market_id", "")),
                    "title": market.get("question", market.get("title", "Unknown")),
                    "description": market.get("description", ""),
                    "category": market.get("category", ""),
                    "similarity": market_item["similarity"],
                    "currentPrice": market.get("price", market.get("probability", None)),
                    "liquidity": market.get("liquidity", None),
                    "rawMarket": market  # Include full market data
                })
            
            return ranked_markets
        else:
            # Fallback: return top candidates by similarity
            return [
                {
                    "marketId": item["market"].get("id", item["market"].get("market_id", "")),
                    "title": item["market"].get("question", item["market"].get("title", "Unknown")),
                    "description": item["market"].get("description", ""),
                    "category": item["market"].get("category", ""),
                    "similarity": item["similarity"],
                    "currentPrice": item["market"].get("price", item["market"].get("probability", None)),
                    "liquidity": item["market"].get("liquidity", None),
                    "rawMarket": item["market"]
                }
                for item in candidate_markets[:top_k]
            ]
    except Exception as e:
        print(f"Error in LLM ranking: {e}")
        # Fallback to similarity-based ranking
        return [
            {
                "marketId": item["market"].get("id", item["market"].get("market_id", "")),
                "title": item["market"].get("question", item["market"].get("title", "Unknown")),
                "description": item["market"].get("description", ""),
                "category": item["market"].get("category", ""),
                "similarity": item["similarity"],
                "currentPrice": item["market"].get("price", item["market"].get("probability", None)),
                "liquidity": item["market"].get("liquidity", None),
                "rawMarket": item["market"]
            }
            for item in candidate_markets[:top_k]
        ]

def match_risk(risk_description: str, top_k: int = 5) -> List[Dict]:
    """
    Main matching function: finds top markets for a risk description.
    Combines embedding similarity with LLM ranking.
    """
    # Step 1: Find top markets by similarity
    candidate_markets = find_top_markets_by_similarity(risk_description, top_n=15)
    
    if not candidate_markets:
        return []
    
    # Step 2: Use LLM to rank candidates
    ranked_markets = llm_rank_markets(risk_description, candidate_markets, top_k=top_k)
    
    return ranked_markets

