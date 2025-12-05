import os
import numpy as np
from typing import List, Dict, Optional
from openai import OpenAI
from services.polymarket import fetch_markets, load_markets, build_market_text

# Lazy initialization of OpenAI client
_client: Optional[OpenAI] = None

def get_openai_client() -> OpenAI:
    """Get or create OpenAI client instance."""
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        # Create client - try simple initialization first
        try:
            _client = OpenAI(api_key=api_key)
        except TypeError as e:
            # If proxies error, create explicit httpx client
            if "proxies" in str(e):
                print("[OPENAI_CLIENT] Encountered proxies error, creating explicit httpx client...")
                import httpx
                http_client = httpx.Client(timeout=60.0)
                _client = OpenAI(api_key=api_key, http_client=http_client)
            else:
                raise
    return _client

def embed_text(text: str, debug_label: str = "text") -> List[float]:
    """Generate embedding for a text using OpenAI."""
    try:
        print(f"[EMBEDDING] Generating embedding for {debug_label} (length: {len(text)} chars)")
        client = get_openai_client()
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        embedding = response.data[0].embedding
        print(f"[EMBEDDING] Successfully generated embedding (dim: {len(embedding)})")
        return embedding
    except Exception as e:
        print(f"[EMBEDDING] ERROR generating embedding for {debug_label}: {e}")
        import traceback
        print(f"[EMBEDDING] Traceback: {traceback.format_exc()}")
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
    print("\n" + "="*80)
    print("[MATCHING] Starting similarity search...")
    print(f"[MATCHING] Risk description: {risk_description[:200]}...")
    print(f"[MATCHING] Looking for top {top_n} markets")
    
    # Fetch/load markets
    print("[MATCHING] Fetching markets...")
    markets = fetch_markets()
    if not markets:
        print("[MATCHING] No markets from fetch, loading from cache...")
        markets = load_markets()
    
    if not markets:
        print("[MATCHING] ERROR: No markets available!")
        return []
    
    print(f"[MATCHING] Processing {len(markets)} markets")
    
    # Generate embedding for risk description
    print("[MATCHING] Generating embedding for risk description...")
    risk_embedding = embed_text(risk_description, "risk_description")
    if not risk_embedding:
        print("[MATCHING] ERROR: Failed to generate risk embedding")
        return []
    print(f"[MATCHING] Risk embedding generated successfully")
    
    # Generate embeddings for all markets and compute similarities
    print("[MATCHING] Computing similarities for all markets...")
    market_similarities = []
    processed = 0
    skipped = 0
    
    for i, market in enumerate(markets):
        if (i + 1) % 100 == 0:
            print(f"[MATCHING] Processed {i + 1}/{len(markets)} markets...")
        
        market_text = build_market_text(market)
        if not market_text or len(market_text.strip()) < 10:
            skipped += 1
            continue
        
        market_embedding = embed_text(market_text, f"market_{i}")
        if not market_embedding:
            skipped += 1
            continue
        
        similarity = compute_cosine_similarity(risk_embedding, market_embedding)
        market_similarities.append({
            "market": market,
            "similarity": similarity
        })
        processed += 1
    
    print(f"[MATCHING] Processed {processed} markets, skipped {skipped}")
    
    if not market_similarities:
        print("[MATCHING] ERROR: No valid similarities computed")
        return []
    
    # Sort by similarity and return top N
    market_similarities.sort(key=lambda x: x["similarity"], reverse=True)
    top_markets = market_similarities[:top_n]
    
    print(f"[MATCHING] Top {len(top_markets)} markets by similarity:")
    for i, item in enumerate(top_markets[:5], 1):
        market = item["market"]
        question = market.get('question', market.get('title', 'Unknown'))[:80]
        similarity = item["similarity"]
        print(f"  {i}. Similarity: {similarity:.4f} | {question}")
    
    print("="*80 + "\n")
    return top_markets

def llm_rank_markets(
    risk_description: str,
    candidate_markets: List[Dict],
    top_k: int = 5
) -> List[Dict]:
    """
    Use LLM to rank candidate markets and return top K.
    """
    print("\n" + "="*80)
    print("[LLM_RANKING] Starting LLM ranking...")
    print(f"[LLM_RANKING] Risk description: {risk_description[:200]}...")
    print(f"[LLM_RANKING] Candidate markets: {len(candidate_markets)}")
    print(f"[LLM_RANKING] Requesting top {top_k} ranked markets")
    
    if not candidate_markets:
        print("[LLM_RANKING] ERROR: No candidate markets provided")
        return []
    
    # Build prompt for LLM
    print("[LLM_RANKING] Building prompt with candidate markets...")
    market_descriptions = []
    for i, item in enumerate(candidate_markets):
        market = item["market"]
        market_id = market.get("id", market.get("market_id", market.get("condition_id", f"market_{i}")))
        title = market.get("question", market.get("title", "Unknown"))
        description = market.get("description", "")
        similarity = item.get("similarity", 0)
        
        market_descriptions.append(
            f"{i+1}. Market ID: {market_id}\n"
            f"   Title: {title}\n"
            f"   Description: {description[:200]}...\n"
            f"   Similarity Score: {similarity:.4f}\n"
        )
        print(f"[LLM_RANKING] Candidate {i+1}: {title[:60]}... (similarity: {similarity:.4f})")
    
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
        print("[LLM_RANKING] Calling OpenAI API...")
        client = get_openai_client()
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
        print(f"[LLM_RANKING] LLM response: {result_text[:200]}...")
        
        # Extract JSON array from response
        import re
        json_match = re.search(r'\[[\d,\s]+\]', result_text)
        if json_match:
            import json
            ranked_indices = json.loads(json_match.group())
            print(f"[LLM_RANKING] Parsed ranked indices: {ranked_indices}")
            
            # Convert to 0-indexed and get top K
            ranked_indices = [idx - 1 for idx in ranked_indices[:top_k] if 0 <= idx - 1 < len(candidate_markets)]
            print(f"[LLM_RANKING] Valid ranked indices (0-indexed): {ranked_indices}")
            
            # Return ranked markets with additional metadata
            ranked_markets = []
            for idx in ranked_indices:
                market_item = candidate_markets[idx]
                market = market_item["market"]
                market_obj = {
                    "marketId": market.get("id", market.get("market_id", market.get("condition_id", ""))),
                    "title": market.get("question", market.get("title", "Unknown")),
                    "description": market.get("description", ""),
                    "category": market.get("category", ""),
                    "similarity": market_item["similarity"],
                    "currentPrice": market.get("price", market.get("probability", None)),
                    "liquidity": market.get("liquidity", None),
                    "rawMarket": market  # Include full market data
                }
                ranked_markets.append(market_obj)
                print(f"[LLM_RANKING] Ranked market: {market_obj['title'][:60]}...")
            
            print(f"[LLM_RANKING] Successfully ranked {len(ranked_markets)} markets")
            print("="*80 + "\n")
            return ranked_markets
        else:
            print("[LLM_RANKING] WARNING: Could not parse JSON from LLM response, using similarity fallback")
            # Fallback: return top candidates by similarity
            fallback_markets = [
                {
                    "marketId": item["market"].get("id", item["market"].get("market_id", item["market"].get("condition_id", ""))),
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
            print(f"[LLM_RANKING] Returning {len(fallback_markets)} markets (similarity fallback)")
            print("="*80 + "\n")
            return fallback_markets
    except Exception as e:
        print(f"[LLM_RANKING] ERROR in LLM ranking: {e}")
        import traceback
        print(f"[LLM_RANKING] Traceback: {traceback.format_exc()}")
        # Fallback to similarity-based ranking
        print("[LLM_RANKING] Falling back to similarity-based ranking")
        fallback_markets = [
            {
                "marketId": item["market"].get("id", item["market"].get("market_id", item["market"].get("condition_id", ""))),
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
        print(f"[LLM_RANKING] Returning {len(fallback_markets)} markets (error fallback)")
        print("="*80 + "\n")
        return fallback_markets

def match_risk(risk_description: str, top_k: int = 5) -> List[Dict]:
    """
    Main matching function: finds top markets for a risk description.
    Combines embedding similarity with LLM ranking.
    """
    print("\n" + "="*80)
    print("[MATCH_RISK] ===== STARTING RISK MATCHING ======")
    print(f"[MATCH_RISK] Risk description: {risk_description}")
    print(f"[MATCH_RISK] Requested top {top_k} markets")
    print("="*80)
    
    # Step 1: Find top markets by similarity
    print("[MATCH_RISK] Step 1: Finding top markets by similarity...")
    candidate_markets = find_top_markets_by_similarity(risk_description, top_n=15)
    
    if not candidate_markets:
        print("[MATCH_RISK] ERROR: No candidate markets found from similarity search")
        print("="*80 + "\n")
        return []
    
    print(f"[MATCH_RISK] Found {len(candidate_markets)} candidate markets from similarity search")
    
    # Step 2: Use LLM to rank candidates
    print("[MATCH_RISK] Step 2: Ranking candidates with LLM...")
    ranked_markets = llm_rank_markets(risk_description, candidate_markets, top_k=top_k)
    
    print("[MATCH_RISK] ===== MATCHING COMPLETE =====")
    print(f"[MATCH_RISK] Final result: {len(ranked_markets)} markets")
    for i, market in enumerate(ranked_markets, 1):
        print(f"  {i}. {market.get('title', 'Unknown')[:80]}...")
    print("="*80 + "\n")
    
    return ranked_markets

