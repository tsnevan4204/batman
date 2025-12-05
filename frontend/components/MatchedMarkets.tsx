'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RiskDetails } from './RiskInput'
import StrategyModal, { HedgePlan } from './StrategyModal'
import { Check, Loader2 } from 'lucide-react'

interface MatchedMarketsProps {
  riskDetails: RiskDetails
  markets: any[]
  onPlanReady: (plan: HedgePlan) => void
  onBack: () => void
}

export default function MatchedMarkets({
  riskDetails,
  markets,
  onPlanReady,
  onBack,
}: MatchedMarketsProps) {
  const [selectedMarkets, setSelectedMarkets] = useState<any[]>([])
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Simulate loading delay for suggestions to populate
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  const totalRevenueRisk = riskDetails.revenues.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  const totalExpenseRisk = riskDetails.expenseRisks.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  const totalRisk = totalRevenueRisk + totalExpenseRisk

  const toggleMarketSelection = (market: any) => {
    if (selectedMarkets.find(m => m.marketId === market.marketId)) {
      setSelectedMarkets(selectedMarkets.filter(m => m.marketId !== market.marketId))
    } else {
      setSelectedMarkets([...selectedMarkets, market])
    }
  }

  const handleOpenStrategy = () => {
    if (selectedMarkets.length > 0) {
      setIsStrategyModalOpen(true)
    }
  }

  // When executing, we might need to iterate over selected markets in the parent.
  // For now, we'll pass the first one to maintain signature compatibility, 
  // or we'd need to refactor the parent to accept an array.
  // To support multi-leg properly, the StrategyModal will return a breakdown.
  const handleStrategyExecute = (plan: HedgePlan) => {
    if (plan.legs.length === 0) return
    onPlanReady(plan)
    setIsStrategyModalOpen(false)
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
                  {riskDetails.revenues.map((exp, idx) => (
                    exp.name && (
                      <span key={`rev-${idx}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-800 border border-green-100">
                        Revenue: {exp.name}: ${exp.amount}
                      </span>
                    )
                  ))}
                  {riskDetails.expenseRisks.map((exp, idx) => (
                    exp.name && (
                      <span key={`exp-${idx}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-800 border border-orange-100">
                        Expense ↑: {exp.name}: ${exp.amount}
                      </span>
                    )
                  ))}
              </div>
            </div>
            <div className="text-right">
               <div className="text-sm text-gray-500">Est. Total Downside</div>
               <div className="text-2xl font-bold text-gray-900 tracking-tight">${totalRisk.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-end mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          Recommended Hedge Markets 
          {!isLoading && (
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-sm font-medium">
              {markets.length} Matches
            </span>
          )}
        </h2>
        
        {/* Multi-select Action Bar */}
        <AnimatePresence>
          {selectedMarkets.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-gray-700"
            >
              <span className="text-sm font-medium bg-gray-800 px-2 py-1 rounded">
                {selectedMarkets.length} Selected
              </span>
              <button 
                onClick={handleOpenStrategy}
                className="font-bold text-hedge-green hover:text-green-400 transition-colors flex items-center gap-2"
              >
                Create Strategy Bundle <span className="text-lg">→</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-12 h-12 text-hedge-green animate-spin mb-4" />
          <p className="text-gray-500 font-medium animate-pulse">Aggregating liquid markets...</p>
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-20 bg-white/50 rounded-xl border border-dashed border-gray-300 backdrop-blur-sm">
          <p className="text-gray-500">No markets found matching your risk profile.</p>
          <button onClick={onBack} className="text-hedge-green hover:underline mt-2 font-medium">
            Try refining your description
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 pb-24">
          {markets.map((market, index) => {
             const isSelected = selectedMarkets.find(m => m.marketId === market.marketId)
             return (
              <motion.div
                key={market.marketId || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => toggleMarketSelection(market)}
                className={`
                  cursor-pointer relative overflow-hidden rounded-xl p-6 shadow-sm transition-all duration-300 border
                  ${isSelected 
                    ? 'bg-green-50 border-hedge-green ring-1 ring-hedge-green' 
                    : 'glass-card bg-white/90 hover:shadow-lg border-gray-200 hover:border-green-200'}
                `}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 text-hedge-green bg-white rounded-full p-1 shadow-sm">
                    <Check size={20} strokeWidth={3} />
                  </div>
                )}
                
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
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-2 transition-colors">
                      {market.title}
                    </h3>
                    
                    <p className="text-gray-600 mb-4 line-clamp-2 text-sm">
                      {market.description || 'No description available'}
                    </p>
                    
                    <div className="flex gap-8 text-sm p-3 bg-white/50 rounded-lg border border-gray-100/50">
                      {market.hedgePrice !== null && market.hedgePrice !== undefined && (
                        <div className="flex flex-col">
                          <span className="text-gray-400 text-xs uppercase font-bold">Current Price</span>
                          <span className="text-gray-900 font-bold text-lg">
                            ${(market.hedgePrice * 100).toFixed(4)}¢ ({market.side || 'Yes'})
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
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <StrategyModal
        isOpen={isStrategyModalOpen}
        onClose={() => setIsStrategyModalOpen(false)}
        selectedMarkets={selectedMarkets}
        totalRisk={totalRisk}
        onExecute={handleStrategyExecute}
      />
    </div>
  )
}
