'use client'

import React, { useState } from 'react'

export type StrategyType = 'conservative' | 'balanced' | 'aggressive'

interface StrategyModalProps {
  isOpen: boolean
  onClose: () => void
  marketTitle: string
  marketPrice: number
  totalExposure: number
  onExecute: (strategy: StrategyType, amount: number) => void
}

export default function StrategyModal({
  isOpen,
  onClose,
  marketTitle,
  marketPrice,
  totalExposure,
  onExecute,
}: StrategyModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('balanced')

  if (!isOpen) return null

  // Default exposure if not provided or zero
  const baseExposure = totalExposure > 0 ? totalExposure : 10000

  const strategies = [
    {
      id: 'conservative' as StrategyType,
      title: 'Conservative',
      coverage: 0.3, // 30%
      label: 'Low Risk',
      description: 'Lower volatility, partial coverage for key downside risks.',
      color: 'border-green-200 hover:border-green-500 bg-green-50',
    },
    {
      id: 'balanced' as StrategyType,
      title: 'Balanced',
      coverage: 0.6, // 60%
      label: 'Medium Risk',
      description: 'Balanced exposure providing significant downside protection.',
      color: 'border-blue-200 hover:border-blue-500 bg-blue-50',
    },
    {
      id: 'aggressive' as StrategyType,
      title: 'Aggressive',
      coverage: 1.0, // 100%
      label: 'High Risk',
      description: 'Full coverage. Maximum protection but higher upfront cost.',
      color: 'border-purple-200 hover:border-purple-500 bg-purple-50',
    },
  ]

  const handleExecute = () => {
    const strategy = strategies.find((s) => s.id === selectedStrategy)
    const amount = (strategy?.coverage || 0) * baseExposure
    onExecute(selectedStrategy, amount)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Select Hedge Strategy</h2>
              <p className="text-sm text-gray-500 mt-1">
                Market: <span className="font-medium text-gray-900">{marketTitle}</span>
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
            <p className="text-sm font-medium text-gray-700 mb-2">
              Estimated Exposure: <span className="text-gray-900">${baseExposure.toLocaleString()}</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {strategies.map((strategy) => {
                const amount = strategy.coverage * baseExposure
                const isSelected = selectedStrategy === strategy.id
                
                return (
                  <div
                    key={strategy.id}
                    onClick={() => setSelectedStrategy(strategy.id)}
                    className={`
                      relative cursor-pointer rounded-lg p-4 border-2 transition-all duration-200
                      ${isSelected ? `border-hedge-green ring-1 ring-hedge-green shadow-sm` : 'border-gray-200 hover:border-gray-300'}
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
                      <div className="text-2xl font-bold text-gray-900 mb-2">
                        ${amount.toLocaleString()}
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-auto">
                        {strategy.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>Selected Strategy</span>
              <span className="font-medium capitalize">{selectedStrategy}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>Coverage</span>
              <span className="font-medium">
                {(strategies.find(s => s.id === selectedStrategy)?.coverage || 0) * 100}%
              </span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total Hedge Cost (USDC)</span>
              <span>${(strategies.find(s => s.id === selectedStrategy)?.coverage || 0) * baseExposure}</span>
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
            className="px-5 py-2.5 bg-hedge-green hover:bg-hedge-green-dark text-white font-bold rounded-lg shadow-sm transition-colors"
          >
            Execute Strategy
          </button>
        </div>
      </div>
    </div>
  )
}

