'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import RiskInput from '@/components/RiskInput'
import MatchedMarkets from '@/components/MatchedMarkets'
import HedgeExecution from '@/components/HedgeExecution'
import Portfolio from '@/components/Portfolio'

type View = 'input' | 'markets' | 'execution' | 'portfolio'

export default function Home() {
  const { isConnected } = useAccount()
  const [currentView, setCurrentView] = useState<View>('input')
  const [riskDescription, setRiskDescription] = useState('')
  const [matchedMarkets, setMatchedMarkets] = useState<any[]>([])
  const [selectedMarket, setSelectedMarket] = useState<any>(null)
  const [hedgeAmount, setHedgeAmount] = useState('')

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Hedger</h1>
            <p className="text-gray-400">Onchain Business Risk Hedging via Polymarket on Base</p>
          </div>
          <div className="flex gap-4 items-center">
            <button
              onClick={() => setCurrentView('portfolio')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
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
              className={`px-4 py-2 rounded-lg ${
                currentView === 'input'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              New Hedge
            </button>
            <button
              onClick={() => setCurrentView('portfolio')}
              className={`px-4 py-2 rounded-lg ${
                currentView === 'portfolio'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              My Hedges
            </button>
          </div>
        )}

        {/* Main Content */}
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Connect Your Base Wallet
            </h2>
            <p className="text-gray-400 mb-8">
              Connect your wallet to start hedging business risks
            </p>
            <ConnectButton />
          </div>
        ) : (
          <>
            {currentView === 'input' && (
              <RiskInput
                onMatch={(description, markets) => {
                  setRiskDescription(description)
                  setMatchedMarkets(markets)
                  setCurrentView('markets')
                }}
              />
            )}

            {currentView === 'markets' && (
              <MatchedMarkets
                riskDescription={riskDescription}
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

