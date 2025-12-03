# Hedger Backend

Python FastAPI backend for Hedger application.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

3. Run the server:
```bash
python main.py
# Or: uvicorn main:app --reload
```

## API Endpoints

- `POST /api/match-risk` - Match a risk description to Polymarket markets
- `POST /api/execute-hedge` - Create EIP-712 order for signing
- `POST /api/submit-order` - Submit signed order to Polymarket
- `GET /api/markets` - Get cached markets from markets.json

## Notes

- Markets are cached in `markets.json` (no database)
- Uses OpenAI embeddings and GPT-4o-mini for matching
- Polymarket CLOB API integration for trading

