'use client'

import { useState } from 'react'

interface MatchedMarketsProps {
  riskDescription: string
  markets: any[]
  onSelectMarket: (market: any, amount: string) => void
  onBack: () => void
}

export default function MatchedMarkets({
  riskDescription,
  markets,
  onSelectMarket,
  onBack,
}: MatchedMarketsProps) {
  const [selectedAmounts, setSelectedAmounts] = useState<{ [key: string]: string }>({})

  const handleHedge = (market: any) => {
    const amount = selectedAmounts[market.marketId] || '100'
    onSelectMarket(market, amount)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-blue-400 hover:text-blue-300 mb-4 flex items-center gap-2"
        >
          ← Back to Risk Input
        </button>
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-400 mb-1">Your Risk:</p>
          <p className="text-white">{riskDescription}</p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mb-6">
        Matched Hedge Markets ({markets.length})
      </h2>

      {markets.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <p className="text-gray-400">No markets found. Try refining your risk description.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {markets.map((market, index) => (
            <div
              key={market.marketId}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded">
                      #{index + 1}
                    </span>
                    {market.category && (
                      <span className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded">
                        {market.category}
                      </span>
                    )}
                    {market.similarity && (
                      <span className="px-3 py-1 bg-green-900/50 text-green-300 text-sm rounded">
                        {Math.round(market.similarity * 100)}% match
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {market.title}
                  </h3>
                  <p className="text-gray-400 mb-4 line-clamp-2">
                    {market.description || 'No description available'}
                  </p>
                  <div className="flex gap-6 text-sm">
                    {market.currentPrice !== null && market.currentPrice !== undefined && (
                      <div>
                        <span className="text-gray-500">Current Price: </span>
                        <span className="text-white font-semibold">
                          ${(market.currentPrice * 100).toFixed(2)}¢
                        </span>
                      </div>
                    )}
                    {market.liquidity && (
                      <div>
                        <span className="text-gray-500">Liquidity: </span>
                        <span className="text-white font-semibold">
                          ${market.liquidity.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-2">
                    Amount to Hedge (USDC)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="100"
                    value={selectedAmounts[market.marketId] || ''}
                    onChange={(e) =>
                      setSelectedAmounts({
                        ...selectedAmounts,
                        [market.marketId]: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => handleHedge(market)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Hedge with this Market
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

