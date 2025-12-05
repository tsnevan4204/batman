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
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border-l-4 border-hedge-green border-y border-r border-gray-200/50 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 rounded-full blur-2xl opacity-20 -mr-10 -mt-10" />
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 relative z-10">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Risk Profile Identified</h3>
              <p className="text-gray-600">
                "{riskDetails.specificRisk}"
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {riskDetails.expenses.map((exp, idx) => (
                  exp.name && (
                    <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-800 border border-green-100">
                      {exp.name}: ${exp.amount}
                    </span>
                  )
                ))}
              </div>
            </div>
            <div className="text-right">
               <div className="text-sm text-gray-500">Est. Total Exposure</div>
               <div className="text-2xl font-bold text-gray-900 tracking-tight">${totalExposure.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
        Recommended Hedge Markets 
        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-sm font-medium">
          {markets.length} Matches
        </span>
      </h2>

      {markets.length === 0 ? (
        <div className="text-center py-20 bg-white/50 rounded-xl border border-dashed border-gray-300 backdrop-blur-sm">
          <p className="text-gray-500">No markets found matching your risk profile.</p>
          <button onClick={onBack} className="text-hedge-green hover:underline mt-2 font-medium">
            Try refining your description
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {markets.map((market, index) => (
            <div
              key={market.marketId || index}
              className="glass-card bg-white/90 rounded-xl p-6 shadow-sm hover:shadow-lg border border-gray-200 transition-all duration-300 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded uppercase tracking-wide border border-blue-100">
                      {market.category || 'Market'}
                    </span>
                    {market.similarity && (
                      <span className="px-2.5 py-0.5 bg-green-50 text-hedge-green text-xs font-bold rounded border border-green-100">
                        {Math.round(market.similarity * 100)}% Match
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-hedge-green transition-colors">
                    {market.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 line-clamp-2 text-sm">
                    {market.description || 'No description available'}
                  </p>
                  
                  <div className="flex gap-8 text-sm p-3 bg-gray-50/50 rounded-lg border border-gray-100">
                    {market.currentPrice !== null && market.currentPrice !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-xs uppercase font-bold">Current Price</span>
                        <span className="text-gray-900 font-bold text-lg">
                          ${(market.currentPrice * 100).toFixed(1)}¢
                        </span>
                      </div>
                    )}
                    {market.liquidity && (
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-xs uppercase font-bold">Liquidity</span>
                        <span className="text-gray-900 font-medium mt-1">
                          ${Number(market.liquidity).toLocaleString()}
                        </span>
                      </div>
                    )}
                     {market.volume && (
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-xs uppercase font-bold">Volume</span>
                        <span className="text-gray-900 font-medium mt-1">
                          ${Number(market.volume).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => handleOpenStrategy(market)}
                    className="w-full md:w-auto px-6 py-3 bg-gray-900 hover:bg-hedge-green text-white font-bold rounded-lg shadow-lg shadow-gray-900/10 hover:shadow-green-500/20 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
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
