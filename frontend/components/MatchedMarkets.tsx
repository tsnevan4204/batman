'use client'

import { useState } from 'react'
import { RiskDetails } from './RiskInput'
import StrategyModal, { StrategyType } from './StrategyModal'

interface MatchedMarketsProps {
  riskDetails: RiskDetails
  markets: any[]
  onSelectMarket: (market: any, amount: string) => void
  onBack: () => void
}

export default function MatchedMarkets({
  riskDetails,
  markets,
  onSelectMarket,
  onBack,
}: MatchedMarketsProps) {
  const [selectedMarketForStrategy, setSelectedMarketForStrategy] = useState<any>(null)
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false)

  // Calculate total exposure from expenses
  const totalExposure = riskDetails.expenses.reduce((acc, curr) => {
    const amount = parseFloat(curr.amount) || 0
    return acc + amount
  }, 0)

  const handleOpenStrategy = (market: any) => {
    setSelectedMarketForStrategy(market)
    setIsStrategyModalOpen(true)
  }

  const handleStrategyExecute = (strategy: StrategyType, amount: number) => {
    if (selectedMarketForStrategy) {
      onSelectMarket(selectedMarketForStrategy, amount.toString())
      setIsStrategyModalOpen(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Navigation */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-hedge-green mb-4 flex items-center gap-2 font-medium transition-colors"
        >
          ← Back to Risk Assessment
        </button>
        
        {/* Risk Summary Banner */}
        <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-hedge-green border-y border-r border-gray-200">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Risk Profile Identified</h3>
              <p className="text-gray-600">
                "{riskDetails.specificRisk}"
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {riskDetails.expenses.map((exp, idx) => (
                  exp.name && (
                    <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {exp.name}: ${exp.amount}
                    </span>
                  )
                ))}
              </div>
            </div>
            <div className="text-right">
               <div className="text-sm text-gray-500">Est. Total Exposure</div>
               <div className="text-2xl font-bold text-gray-900">${totalExposure.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Recommended Hedge Markets ({markets.length})
      </h2>

      {markets.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500">No markets found matching your risk profile.</p>
          <button onClick={onBack} className="text-hedge-green hover:underline mt-2">
            Try refining your description
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {markets.map((market, index) => (
            <div
              key={market.marketId || index}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-hedge-green/50 hover:shadow-md transition-all"
            >
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded uppercase tracking-wide">
                      {market.category || 'Market'}
                    </span>
                    {market.similarity && (
                      <span className="px-2.5 py-0.5 bg-green-50 text-hedge-green text-xs font-bold rounded">
                        {Math.round(market.similarity * 100)}% Match
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {market.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 line-clamp-2 text-sm">
                    {market.description || 'No description available'}
                  </p>
                  
                  <div className="flex gap-8 text-sm">
                    {market.currentPrice !== null && market.currentPrice !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-xs uppercase font-semibold">Current Price</span>
                        <span className="text-gray-900 font-bold text-lg">
                          ${(market.currentPrice * 100).toFixed(1)}¢
                        </span>
                      </div>
                    )}
                    {market.liquidity && (
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-xs uppercase font-semibold">Liquidity</span>
                        <span className="text-gray-900 font-medium">
                          ${Number(market.liquidity).toLocaleString()}
                        </span>
                      </div>
                    )}
                     {market.volume && (
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-xs uppercase font-semibold">Volume</span>
                        <span className="text-gray-900 font-medium">
                          ${Number(market.volume).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => handleOpenStrategy(market)}
                    className="w-full md:w-auto px-6 py-3 bg-hedge-green hover:bg-hedge-green-dark text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Hedge with this Market</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <StrategyModal
        isOpen={isStrategyModalOpen}
        onClose={() => setIsStrategyModalOpen(false)}
        marketTitle={selectedMarketForStrategy?.title || ''}
        marketPrice={selectedMarketForStrategy?.currentPrice || 0}
        totalExposure={totalExposure}
        onExecute={handleStrategyExecute}
      />
    </div>
  )
}
