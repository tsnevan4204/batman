'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import RiskInput, { RiskDetails } from '@/components/RiskInput'
import MatchedMarkets from '@/components/MatchedMarkets'
import HedgeExecution from '@/components/HedgeExecution'
import Portfolio from '@/components/Portfolio'

type View = 'input' | 'markets' | 'execution' | 'portfolio'

export default function Home() {
  const { isConnected } = useAccount()
  const [currentView, setCurrentView] = useState<View>('input')
  const [riskDescription, setRiskDescription] = useState('')
  const [riskDetails, setRiskDetails] = useState<RiskDetails | null>(null)
  const [matchedMarkets, setMatchedMarkets] = useState<any[]>([])
  const [selectedMarket, setSelectedMarket] = useState<any>(null)
  const [hedgeAmount, setHedgeAmount] = useState('')

  return (
    <main className="min-h-screen p-8 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Hedger</h1>
            <p className="text-gray-500">Onchain Business Risk Hedging via Polymarket on Base</p>
          </div>
          <div className="flex gap-4 items-center">
            <button
              onClick={() => setCurrentView('portfolio')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
            >
              Portfolio
            </button>
            <ConnectButton />
          </div>
        </div>

        {/* Navigation */}
        {isConnected && (
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setCurrentView('input')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === 'input'
                  ? 'bg-hedge-green text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              New Hedge
            </button>
            <button
              onClick={() => setCurrentView('portfolio')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === 'portfolio'
                  ? 'bg-hedge-green text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              My Hedges
            </button>
          </div>
        )}

        {/* Main Content */}
        {!isConnected ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Connect Your Base Wallet
            </h2>
            <p className="text-gray-500 mb-8">
              Connect your wallet to start hedging business risks
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        ) : (
          <>
            {currentView === 'input' && (
              <RiskInput
                onMatch={(description, markets, details) => {
                  setRiskDescription(description)
                  setMatchedMarkets(markets)
                  setRiskDetails(details)
                  setCurrentView('markets')
                }}
              />
            )}

            {currentView === 'markets' && riskDetails && (
              <MatchedMarkets
                riskDetails={riskDetails}
                markets={matchedMarkets}
                onSelectMarket={(market, amount) => {
                  setSelectedMarket(market)
                  setHedgeAmount(amount)
                  setCurrentView('execution')
                }}
                onBack={() => setCurrentView('input')}
              />
            )}

            {currentView === 'execution' && (
              <HedgeExecution
                riskDescription={riskDescription}
                market={selectedMarket}
                amount={hedgeAmount}
                onComplete={() => {
                  setCurrentView('portfolio')
                }}
                onBack={() => setCurrentView('markets')}
              />
            )}

            {currentView === 'portfolio' && (
              <Portfolio />
            )}
          </>
        )}
      </div>
    </main>
  )
}
