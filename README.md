# Hedger — Onchain Business Risk Hedging via Polymarket on Base

Hedger is a Base-native application that enables businesses to hedge real-world operational risks by matching natural-language descriptions of their risk to relevant prediction markets on Polymarket, and executing hedges using USDC on Base.

## Architecture

```
root/
├── frontend/        # Next.js web UI
├── backend/         # Python FastAPI backend
└── contracts/       # Solidity contracts for Base
```

## Quick Start

### 1. Smart Contracts

```bash
cd contracts
npm install
# Create .env file with PRIVATE_KEY and BASE_RPC_URL
npm run compile
npm run deploy:baseSepolia  # or deploy:base for mainnet
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
# Create .env file with OPENAI_API_KEY
python main.py
```

The backend will run on `http://localhost:8000`

### 3. Frontend

```bash
cd frontend
npm install
# Create .env.local file with:
# - NEXT_PUBLIC_API_URL=http://localhost:8000
# - NEXT_PUBLIC_HEDGE_REGISTRY_ADDRESS=<deployed contract address>
# - NEXT_PUBLIC_HEDGE_RECEIPT_NFT_ADDRESS=<deployed contract address>
# - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your project id>
npm run dev
```

The frontend will run on `http://localhost:3000`

## Features

- **Risk Intake**: Natural language risk description
- **Market Matching**: AI-powered matching using embeddings + LLM ranking
- **Trade Execution**: EIP-712 order signing and Polymarket CLOB integration
- **Onchain Recording**: Base smart contract records hedges and mints NFT receipts
- **Portfolio View**: View all your hedges and NFT receipts

## Tech Stack

- **Base**: EVM L2 for smart contracts
- **Frontend**: Next.js, React, RainbowKit, Wagmi, Ethers.js
- **Backend**: Python, FastAPI, OpenAI (embeddings + GPT-4o-mini)
- **Contracts**: Solidity, Hardhat, OpenZeppelin
- **Trading**: Polymarket CLOB API

## Project Structure

- `contracts/`: Solidity smart contracts (HedgeRegistry, HedgeReceiptNFT)
- `backend/`: FastAPI server with matching engine and Polymarket integration
- `frontend/`: Next.js web application with wallet integration

## Environment Variables

See `.env.example` files in each directory for required configuration.

## License

MIT

