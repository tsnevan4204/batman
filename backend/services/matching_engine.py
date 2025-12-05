import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from openai import OpenAI

from services.polymarket import search_events

# Lazy initialization of OpenAI client
_client: Optional[OpenAI] = None

# Minimal stopword list to keep search queries tight
STOPWORDS = {
    "the",
    "and",
    "or",
    "a",
    "an",
    "of",
    "to",
    "in",
    "for",
    "on",
    "at",
    "my",
    "will",
    "with",
    "about",
    "this",
    "that",
    "is",
    "are",
    "was",
    "were",
}


def get_openai_client() -> OpenAI:
    """Get or create OpenAI client instance."""
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        try:
            _client = OpenAI(api_key=api_key)
        except TypeError as e:
            if "proxies" in str(e):
                print("[OPENAI_CLIENT] proxies error, creating explicit httpx client...")
                import httpx

                http_client = httpx.Client(timeout=60.0)
                _client = OpenAI(api_key=api_key, http_client=http_client)
            else:
                raise
    return _client


def _chat_with_retry(
    messages: List[Dict[str, str]],
    model: str = "gpt-4o",
    temperature: float = 0.2,
    max_tokens: int = 200,
    attempts: int = 3,
    delay_seconds: float = 1.5,
) -> Optional[str]:
    """
    Call OpenAI chat with simple retries to handle transient failures.
    Returns response content string or None.
    """
    last_err = None
    client = get_openai_client()
    for attempt in range(1, attempts + 1):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            last_err = e
            print(f"[OPENAI_RETRY] attempt {attempt}/{attempts} failed: {e}")
            if attempt < attempts:
                time.sleep(delay_seconds * attempt)
    print(f"[OPENAI_RETRY] giving up after {attempts} attempts: {last_err}")
    return None


def _parse_json_content(raw: str) -> Optional[dict]:
    """
    Parse JSON from an LLM response that may include markdown fences.
    Accepts plain JSON, ```json ...```, or ``` ... ```.
    """
    if raw is None:
        return None
    text = raw.strip()
    # Strip ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        # remove leading fence
        text = text.strip("`")
        # remove optional language tag
        if text.startswith("json"):
            text = text[len("json") :].lstrip()
        # Everything after the first newline should be JSON
        parts = text.split("\n", 1)
        text = parts[1] if len(parts) > 1 else parts[0]
        # Remove trailing fence if present
        text = text.rsplit("```", 1)[0].strip()

    # Try direct JSON load
    try:
        return json.loads(text)
    except Exception:
        # Try to extract first JSON object with a regex fallback
        import re

        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                return None
    return None


def _default_start_date() -> datetime:
    """
    Default start date: beginning of today (UTC) minus 12 hours.
    """
    now = datetime.now(timezone.utc)
    start_today = datetime(year=2025, month=1, day=1, tzinfo=timezone.utc)
    return start_today - timedelta(hours=12)


def _parse_iso_date(value: Optional[str]) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


def _serialize_date(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _normalize_clob_token_ids(raw_ids, tokens_hint=None) -> List[str]:
    """
    Normalize token identifiers to a string list.
    Accepts lists, JSON strings, or comma-separated strings.
    Falls back to tokens array if provided.
    """
    if isinstance(raw_ids, list):
        ids = [str(x) for x in raw_ids if x is not None]
        if ids:
            return ids

    if isinstance(raw_ids, str):
        # Try JSON first
        try:
            parsed = json.loads(raw_ids)
            if isinstance(parsed, list):
                ids = [str(x) for x in parsed if x is not None]
                if ids:
                    return ids
        except Exception:
            pass

        cleaned = raw_ids.strip().strip("[]")
        if cleaned:
            parts = [p.strip().strip('"').strip("'") for p in cleaned.split(",") if p.strip()]
            ids = [p for p in parts if p]
            if ids:
                return ids

    if tokens_hint and isinstance(tokens_hint, list):
        ids = []
        for t in tokens_hint:
            token_id = t.get("token_id") or t.get("id")
            if token_id:
                ids.append(str(token_id))
        if ids:
            return ids

    return []


def _fallback_keyword_query(risk_description: str, max_terms: int = 6) -> str:
    """
    Lightweight keyword extractor as a backstop if LLM parsing fails.
    """
    tokens = re.findall(r"[A-Za-z0-9%]+", risk_description.lower())
    keywords = [t for t in tokens if t not in STOPWORDS]
    return " ".join(keywords[:max_terms]) if keywords else risk_description[:100]


def build_search_plan(risk_description: str) -> Tuple[str, datetime, Optional[datetime]]:
    """
    Use LLM to derive a concise search query and optional start/end dates.
    Returns (query, start_date, end_date).
    """
    prompt = f"""
You help pick Polymarket search queries for hedging risk.
Return a compact JSON object with keys: query, start_date, end_date.
- query: strip filler words, keep only core nouns/verbs (proper nouns ok).
- start_date/end_date: ISO8601 (Z). If date not mentioned, leave empty string.
- If only a broad timeframe is implied (e.g., "next quarter"), leave fields empty.
- Do not add explanations. Only JSON.

Risk description:
{risk_description}
"""
    try:
        content = _chat_with_retry(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "Return only valid JSON with keys: query, start_date, end_date.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=200,
        )
        if content is None:
            raise RuntimeError("LLM returned no content after retries")
        print(f"[SEARCH_PLAN] LLM raw response: {content}")
        plan = _parse_json_content(content)
        if not plan:
            raise ValueError("LLM response did not contain valid JSON")
    except Exception as e:
        print(f"[SEARCH_PLAN] Failed to parse LLM response ({e}), using fallback keywords")
        plan = {
            "query": _fallback_keyword_query(risk_description),
            "start_date": "",
            "end_date": "",
        }

    query = plan.get("query") or _fallback_keyword_query(risk_description)
    start_date = _parse_iso_date(plan.get("start_date"))
    end_date = _parse_iso_date(plan.get("end_date"))

    if not start_date:
        start_date = _default_start_date()

    return query.strip(), start_date, end_date


def flatten_events_to_markets(events: List[Dict], start_date: datetime, end_date: Optional[datetime]) -> List[Dict]:
    """
    Flatten events -> markets while attaching event metadata and applying date filters.
    """
    candidates = []
    for event in events or []:
        event_start = _parse_iso_date(event.get("startDate") or event.get("startTime"))
        if start_date and event_start and event_start < start_date:
            continue
        if end_date and event_start and event_start > end_date:
            continue

        event_title = event.get("title") or event.get("ticker")
        event_description = event.get("description") or event.get("subtitle") or ""

        for market in event.get("markets", []) or []:
            market_id = market.get("id") or market.get("market_id") or market.get("conditionId") or market.get("condition_id")
            if not market_id:
                continue

            clob_token_ids = _normalize_clob_token_ids(market.get("clobTokenIds"), market.get("tokens"))
            # If clobTokenIds missing, attempt from tokens
            if not clob_token_ids and isinstance(market.get("tokens"), list):
                clob_token_ids = _normalize_clob_token_ids(None, market.get("tokens"))

            enriched = {
                **market,
                "marketId": str(market_id),
                "event_title": event_title,
                "event_description": event_description,
                "event_start": _serialize_date(event_start),
                "event_end": _serialize_date(_parse_iso_date(event.get("endDate"))),
                "clobTokenIds": clob_token_ids,
            }
            candidates.append(enriched)
    print(f"[FLATTEN] Prepared {len(candidates)} candidate markets after date filters")
    return candidates


def _build_candidate_prompt(risk_description: str, markets: List[Dict], top_n: int) -> str:
    """
    Build concise prompt for LLM market selection.
    """
    lines = []
    for idx, m in enumerate(markets[:top_n], 1):
        outcomes = m.get("outcomes") or m.get("shortOutcomes")
        if isinstance(outcomes, list):
            outcomes_text = ", ".join(outcomes[:4])
        else:
            outcomes_text = str(outcomes) if outcomes else "Yes/No"

        lines.append(
            f"""{idx}. market_id: {m.get('marketId')}
   title: {m.get('question') or m.get('title', 'Unknown')}
   event: {m.get('event_title') or 'N/A'}
   start: {m.get('event_start') or m.get('startDateIso') or m.get('startDate')}
   end: {m.get('endDateIso') or m.get('endDate')}
   outcomes: {outcomes_text}
   desc: {(m.get('description') or '')[:200]}"""
        )

    prompt = f"""
You are selecting Polymarket markets to hedge a risk.
Risk: {risk_description}

Candidates:
{chr(10).join(lines)}

Return ONLY JSON array sorted best to worst.
Format: [{{"market_id": "<id>", "yesOrNo": "yes" | "no"}}]
- Include only markets that directly hedge the risk.
- Choose the side that most benefits from the risk outcome (Yes/No).
- Prefer clarity, relevance, and timely resolution.
- Max {top_n} items.
"""
    return prompt


def llm_select_markets(risk_description: str, markets: List[Dict], top_k: int = 5) -> List[Dict]:
    """
    Final LLM pass to pick relevant markets and the side (Yes/No).
    """
    if not markets:
        return []

    prompt = _build_candidate_prompt(risk_description, markets, top_k * 3)

    try:
        raw = _chat_with_retry(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Return only JSON. Do not include markdown."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.25,
            max_tokens=300,
        )
        if raw is None:
            raise RuntimeError("LLM returned no content after retries")
        print(f"[FINAL_LLM] Raw response: {raw}")
        selection = _parse_json_content(raw)
        if not isinstance(selection, list):
            raise ValueError("LLM output is not a list")
    except Exception as e:
        print(f"[FINAL_LLM] Failed to parse LLM output ({e})")
        return []

    # Map by marketId for quick lookup
    market_map = {str(m.get("marketId")): m for m in markets}

    results: List[Dict] = []
    for item in selection:
        try:
            market_id = str(item.get("market_id") or item.get("marketId") or "")
            side_raw = str(item.get("yesOrNo") or item.get("side") or "").lower()
            if not market_id or side_raw not in {"yes", "no"}:
                continue

            market = market_map.get(market_id)
            if not market:
                continue

            clob_ids = market.get("clobTokenIds") or []
            if len(clob_ids) < 2:
                print(f"[FINAL_LLM] Skipping {market_id}: missing clobTokenIds")
                continue

            side_index = 0 if side_raw == "yes" else 1
            if side_index >= len(clob_ids):
                continue

            selected_token_id = clob_ids[side_index]
            market_obj = {
                "marketId": market_id,
                "title": market.get("question") or market.get("title", "Unknown"),
                "description": market.get("description", ""),
                "category": market.get("category", ""),
                "eventTitle": market.get("event_title"),
                "eventDescription": market.get("event_description"),
                "startDate": market.get("startDate") or market.get("startDateIso") or market.get("event_start"),
                "endDate": market.get("endDate") or market.get("endDateIso") or market.get("event_end"),
                "side": "Yes" if side_raw == "yes" else "No",
                "clobTokenId": selected_token_id,
                "clobTokenIds": clob_ids,
                "outcomes": market.get("outcomes") or market.get("shortOutcomes"),
                "outcomePrices": market.get("outcomePrices"),
                "liquidity": market.get("liquidity"),
                "volume": market.get("volume"),
            }
            results.append(market_obj)

            if len(results) >= top_k:
                break
        except Exception as e:
            print(f"[FINAL_LLM] Skipping market due to error: {e}")
            continue

    print(f"[FINAL_LLM] Returning {len(results)} markets")
    return results


def hedge_risk(risk_description: str, top_k: int = 5) -> List[Dict]:
    """
    New flow for hedging:
    1) LLM creates search query + dates
    2) Call Polymarket /search API
    3) Flatten events->markets
    4) Final LLM picks relevant markets & side
    """
    print("\n" + "=" * 80)
    print("[HEDGE_RISK] ===== START =====")
    print(f"[HEDGE_RISK] Risk: {risk_description[:200]}...")
    query, start_date, end_date = build_search_plan(risk_description)
    print(f"[HEDGE_RISK] Search query: {query}")
    print(f"[HEDGE_RISK] Start date: {_serialize_date(start_date)} | End date: {_serialize_date(end_date)}")

    search_results = search_events(query, limit_per_type=200)
    events = search_results.get("events", []) if isinstance(search_results, dict) else []
    print(f"[HEDGE_RISK] /search returned {len(events)} events")

    candidates = flatten_events_to_markets(events, start_date, end_date)
    if not candidates:
        print("[HEDGE_RISK] No candidates after flattening")
        return []

    ranked = llm_select_markets(risk_description, candidates, top_k=top_k)
    print("[HEDGE_RISK] ===== DONE =====\n")
    return ranked


# Backward-compatible alias
def match_risk(risk_description: str, top_k: int = 5) -> List[Dict]:
    return hedge_risk(risk_description, top_k=top_k)

