'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { motion, AnimatePresence } from 'framer-motion'
import RiskInput, { RiskDetails } from '@/components/RiskInput'
import MatchedMarkets from '@/components/MatchedMarkets'
import HedgeExecution from '@/components/HedgeExecution'
import Portfolio from '@/components/Portfolio'
import Sidebar from '@/components/Sidebar'
import ProcessingOverlay from '@/components/ProcessingOverlay'

type View = 'input' | 'markets' | 'execution' | 'portfolio'

export default function Home() {
  const { isConnected } = useAccount()
  const [currentView, setCurrentView] = useState<View>('input')
  const [riskDescription, setRiskDescription] = useState('')
  const [riskDetails, setRiskDetails] = useState<RiskDetails | null>(null)
  const [matchedMarkets, setMatchedMarkets] = useState<any[]>([])
  const [selectedMarket, setSelectedMarket] = useState<any>(null)
  const [hedgeAmount, setHedgeAmount] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Handler for risk match
  const handleRiskMatch = (description: string, markets: any[], details: RiskDetails) => {
    setIsProcessing(true)
    // Simulate processing time for animation
    setTimeout(() => {
      setRiskDescription(description)
      setMatchedMarkets(markets)
      setRiskDetails(details)
      setIsProcessing(false)
      setCurrentView('markets')
    }, 4000) // 4 seconds of animation glory
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Sidebar 
        currentView={currentView} 
        onNavigate={(view) => setCurrentView(view)} 
      />

      <ProcessingOverlay isVisible={isProcessing} riskDescription={riskDescription} />

      <div className="lg:pl-72 min-h-screen transition-all duration-300">
        <div className="max-w-7xl mx-auto p-6 lg:p-12">
          
          {/* Top Bar (Mobile/Tablet Connect + Title) */}
          <div className="flex justify-between items-center mb-10">
            <div className="lg:hidden">
               <h1 className="text-2xl font-bold text-gray-900">Hedger</h1>
            </div>
            <div className="ml-auto">
              <ConnectButton showBalance={false} />
            </div>
          </div>

          {/* Main Content Area */}
          <AnimatePresence mode='wait'>
            {!isConnected ? (
              <motion.div 
                key="connect"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-32 text-center"
              >
                <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-green-500/10 animate-float">
                  <div className="w-10 h-10 bg-hedge-green rounded-xl" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Institutional Grade Risk Hedging
                </h2>
                <p className="text-gray-500 mb-8 max-w-md text-lg">
                  Connect your wallet to access onchain prediction markets tailored to your business exposure.
                </p>
                <div className="scale-110">
                  <ConnectButton />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={currentView}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {currentView === 'input' && (
                  <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">New Risk Assessment</h1>
                    <p className="text-gray-500 mb-8">Define your business context to identify relevant market hedges.</p>
                    <div className="glass-card rounded-2xl p-1">
                       <RiskInput onMatch={handleRiskMatch} />
                    </div>
                  </div>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  )
}
