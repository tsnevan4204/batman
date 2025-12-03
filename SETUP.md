# Hedger Setup Guide

Complete setup instructions for running Hedger locally and deploying to Base.

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Git
- A Base wallet with testnet ETH (for testing)
- OpenAI API key
- WalletConnect Project ID (for frontend wallet connection)

## Step 1: Clone and Setup

```bash
cd batman
```

## Step 2: Smart Contracts Setup

```bash
cd contracts
npm install
```

Create `.env` file:
```bash
cp .env.example .env
# Edit .env and add:
# - PRIVATE_KEY (your deployer wallet private key)
# - BASE_RPC_URL or BASE_SEPOLIA_RPC_URL
```

Compile contracts:
```bash
npm run compile
```

Deploy to Base Sepolia (testnet):
```bash
npm run deploy:baseSepolia
```

Save the deployed contract addresses for frontend configuration.

## Step 3: Backend Setup

```bash
cd ../backend
pip install -r requirements.txt
```

Create `.env` file:
```bash
cp .env.example .env
# Edit .env and add:
# - OPENAI_API_KEY=your_openai_api_key
```

Start the backend server:
```bash
python main.py
```

The backend will run on `http://localhost:8000`

## Step 4: Frontend Setup

```bash
cd ../frontend
npm install
```

Create `.env.local` file:
```bash
cp .env.example .env.local
# Edit .env.local and add:
# - NEXT_PUBLIC_API_URL=http://localhost:8000
# - NEXT_PUBLIC_HEDGE_REGISTRY_ADDRESS=<from deployment>
# - NEXT_PUBLIC_HEDGE_RECEIPT_NFT_ADDRESS=<from deployment>
# - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<from walletconnect.com>
```

Start the frontend:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Step 5: Testing the Flow

1. Open `http://localhost:3000` in your browser
2. Connect your Base wallet (Base Sepolia for testnet)
3. Enter a risk description (e.g., "Risk of supply chain disruption")
4. Review matched markets
5. Select a market and enter hedge amount
6. Sign the order and execute the hedge
7. View your hedges in the Portfolio section

## Important Notes

### Polymarket API Integration

The Polymarket API endpoints in `backend/services/polymarket.py` may need adjustment based on:
- Actual Polymarket CLOB API documentation
- API authentication requirements
- Endpoint structure changes

Check https://docs.polymarket.com/ for the latest API structure.

### EIP-712 Order Signing

The EIP-712 order structure in `backend/routers/execute_hedge.py` is simplified. You must:
- Match Polymarket's exact EIP-712 schema
- Use correct domain separator
- Include all required fields
- Verify chain ID (Base = 8453)

### USDC on Base

Ensure users have USDC on Base (not just ETH). USDC on Base uses 6 decimals.

## Troubleshooting

### Backend Issues
- Check OpenAI API key is valid
- Verify Polymarket API endpoints are accessible
- Check `markets.json` is being created

### Frontend Issues
- Verify contract addresses are correct
- Check WalletConnect Project ID
- Ensure backend is running on correct port

### Contract Issues
- Verify contracts compiled successfully
- Check deployment addresses match frontend config
- Ensure HedgeReceiptNFT has HedgeRegistry set correctly

## Production Deployment

For production:
1. Deploy contracts to Base mainnet
2. Update frontend environment variables
3. Use production API endpoints
4. Configure proper CORS settings
5. Set up monitoring and error tracking

