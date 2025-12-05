'use client'

import React, { useMemo, useState } from 'react'

export type StrategyType = 'conservative' | 'balanced' | 'aggressive'

export interface HedgeLeg {
  marketId: string
  title: string
  side: 'Yes' | 'No'
  hedgePrice: number
  hedgePayout: number
  contracts: number
  cost: number
  riskPortion: number
}

export interface HedgePlan {
  strategy: StrategyType
  coverage: number
  totalRisk: number
  totalCost: number
  legs: HedgeLeg[]
}

interface StrategyModalProps {
  isOpen: boolean
  onClose: () => void
  selectedMarkets: any[]
  totalRisk: number
  onExecute: (plan: HedgePlan) => void
}

export default function StrategyModal({
  isOpen,
  onClose,
  selectedMarkets,
  totalRisk,
  onExecute,
}: StrategyModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('balanced')

  const coverageByStrategy: Record<StrategyType, number> = {
    conservative: 0.5, // 50% hedge
    balanced: 0.75, // 25% less than full
    aggressive: 1.0, // equalize payoffs
  }

  const baseRisk = totalRisk > 0 ? totalRisk : 10000

  const strategies = [
    {
      id: 'conservative' as StrategyType,
      title: 'Conservative',
      coverage: coverageByStrategy.conservative,
      label: 'Low Risk',
      description: 'Targets ~50% of the downside. Low cost, keeps upside.',
      color: 'border-green-200 hover:border-green-500 bg-green-50',
    },
    {
      id: 'balanced' as StrategyType,
      title: 'Balanced',
      coverage: coverageByStrategy.balanced,
      label: 'Medium Risk',
      description: 'Covers ~75% of downside while retaining some upside.',
      color: 'border-blue-200 hover:border-blue-500 bg-blue-50',
    },
    {
      id: 'aggressive' as StrategyType,
      title: 'Aggressive',
      coverage: coverageByStrategy.aggressive,
      label: 'High Risk',
      description: 'Full equalized hedge based on payout math.',
      color: 'border-purple-200 hover:border-purple-500 bg-purple-50',
    },
  ]

  const buildPlan = useMemo(() => {
    return (strategy: StrategyType): HedgePlan => {
      const coverage = coverageByStrategy[strategy]
      const perLegRisk = baseRisk / Math.max(selectedMarkets.length, 1)

      const legs: HedgeLeg[] = selectedMarkets.map((m) => {
        const side = (m.side || 'Yes').toString().toLowerCase() === 'no' ? 'No' : 'Yes'
        const price = side === 'Yes'
          ? Number(m.priceYes ?? m.hedgePrice ?? 0.5)
          : Number(m.priceNo ?? m.hedgePrice ?? 0.5)
        const payout = side === 'Yes'
          ? Number(m.payoutYes ?? m.hedgePayout ?? 1)
          : Number(m.payoutNo ?? m.hedgePayout ?? 1)

        const riskPortion = perLegRisk * coverage
        const contracts = payout > 0 ? riskPortion / payout : 0
        const cost = contracts * price

        return {
          marketId: m.marketId,
          title: m.title,
          side,
          hedgePrice: price,
          hedgePayout: payout,
          contracts,
          cost,
          riskPortion,
        }
      })

      const totalCost = legs.reduce((acc, leg) => acc + leg.cost, 0)

      return {
        strategy,
        coverage,
        totalRisk: baseRisk * coverage,
        totalCost,
        legs,
      }
    }
  }, [baseRisk, coverageByStrategy, selectedMarkets])

  const activePlan = buildPlan(selectedStrategy)

  if (!isOpen) return null

  const handleExecute = () => {
    onExecute(activePlan)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Configure Multi-Leg Strategy</h2>
              <p className="text-sm text-gray-500 mt-1">
                Bundling <span className="font-bold text-gray-900">{selectedMarkets.length} markets</span> into a unified hedge.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="mb-6">
             {/* Market Summary List */}
            <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-3">Selected Contracts (Legs)</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                {selectedMarkets.map((market, idx) => {
                  const side = (market.side || 'Yes').toLowerCase() === 'no' ? 'No' : 'Yes'
                  const price = side === 'Yes'
                    ? Number(market.priceYes ?? market.hedgePrice ?? 0.5)
                    : Number(market.priceNo ?? market.hedgePrice ?? 0.5)

                  return (
                    <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-gray-200">
                      <div className="truncate max-w-[300px] font-medium text-gray-700">
                        {market.title}
                        <span className="ml-1 text-xs text-gray-500">({side})</span>
                      </div>
                      <span className="text-gray-400 text-xs">${(price * 100).toFixed(4)}¢</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-sm font-medium text-gray-700 mb-2">
              Total Downside to Hedge: <span className="text-gray-900">${baseRisk.toLocaleString()}</span>
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {strategies.map((strategy) => {
                const amount = strategy.coverage * baseRisk
                const isSelected = selectedStrategy === strategy.id
                
                return (
                  <div
                    key={strategy.id}
                    onClick={() => setSelectedStrategy(strategy.id)}
                    className={`
                      relative cursor-pointer rounded-lg p-4 border-2 transition-all duration-200
                      ${isSelected ? `border-hedge-green ring-1 ring-hedge-green shadow-sm transform scale-[1.02]` : 'border-gray-200 hover:border-gray-300'}
                      bg-white
                    `}
                  >
                    <div className="flex flex-col h-full">
                      <div className="mb-3">
                        <span className={`
                          inline-block px-2 py-1 text-xs font-semibold rounded-full
                          ${strategy.id === 'conservative' ? 'bg-green-100 text-green-800' : ''}
                          ${strategy.id === 'balanced' ? 'bg-blue-100 text-blue-800' : ''}
                          ${strategy.id === 'aggressive' ? 'bg-purple-100 text-purple-800' : ''}
                        `}>
                          {strategy.label}
                        </span>
                      </div>
                      
                      <h3 className="font-bold text-gray-900 mb-1">{strategy.title}</h3>
                      <div className="text-xl font-bold text-gray-900 mb-2">
                        ${amount.toLocaleString()}
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-auto leading-relaxed">
                        {strategy.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
            <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>Aggregate Coverage</span>
              <span className="font-bold text-blue-700">
                {(activePlan.coverage || 0) * 100}%
              </span>
            </div>
             <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>Allocation Per Leg (cost)</span>
              <span className="font-mono text-gray-800">
                ~${selectedMarkets.length > 0 ? (activePlan.totalCost / selectedMarkets.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
              </span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-gray-900 pt-2 border-t border-blue-200 mt-2">
              <span>Total Hedge Allocation (USDC)</span>
              <span>${activePlan.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="mt-3 bg-white rounded border border-blue-100 p-3 text-xs text-gray-600">
              <div className="font-semibold text-gray-800 mb-2">Leg breakdown</div>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {activePlan.legs.map((leg) => (
                  <div key={leg.marketId} className="flex justify-between">
                    <div className="truncate max-w-[220px]">
                      <span className="text-gray-800 font-medium">{leg.title}</span>
                      <span className="text-gray-500 ml-1">({leg.side})</span>
                    </div>
                    <div className="text-right text-gray-700 font-mono">
                      <div>${leg.cost.toFixed(2)} cost</div>
                      <div className="text-gray-500">{leg.contracts.toFixed(2)} shares @ ${(leg.hedgePrice * 100).toFixed(4)}¢</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            className="px-5 py-2.5 bg-gradient-to-r from-hedge-green to-emerald-600 hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg shadow-green-500/20 transition-all transform hover:-translate-y-0.5"
          >
            Execute Bundle
          </button>
        </div>
      </div>
    </div>
  )
}
