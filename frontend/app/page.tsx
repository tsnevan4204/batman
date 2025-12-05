'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import RiskInput, { RiskDetails } from '@/components/RiskInput'
import MatchedMarkets from '@/components/MatchedMarkets'
import HedgeExecution from '@/components/HedgeExecution'
import Portfolio from '@/components/Portfolio'
import Sidebar from '@/components/Sidebar'
import ProcessingOverlay from '@/components/ProcessingOverlay'
import { Wallet, ConnectWallet, WalletDropdown, WalletDropdownLink, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity, EthBalance } from '@coinbase/onchainkit/identity';

type View = 'input' | 'markets' | 'execution' | 'portfolio'

export default function Home() {
  const { isConnected } = useAccount()
  const SKIP_MATCH = process.env.NEXT_PUBLIC_SKIP_MATCH === 'true'
  const [mounted, setMounted] = useState(false)
  const [currentView, setCurrentView] = useState<View>('input')
  const [riskDescription, setRiskDescription] = useState('')
  const [riskDetails, setRiskDetails] = useState<RiskDetails | null>(null)
  const [matchedMarkets, setMatchedMarkets] = useState<any[]>([])
  const [selectedMarket, setSelectedMarket] = useState<any>(null)
  const [hedgeAmount, setHedgeAmount] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Prevent hydration mismatch for client-only wallet components
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handler for risk match
  const handleRiskMatch = (description: string, markets: any[], details: RiskDetails) => {
    if (SKIP_MATCH) {
      const fallbackMarket = markets[0] || {
        marketId: 'demo-market',
        title: 'Demo Hedge Market',
        currentPrice: 0.5,
      }
      setRiskDescription(description || 'Demo risk context')
      setMatchedMarkets(markets)
      setRiskDetails(details)
      setSelectedMarket(fallbackMarket)
      setHedgeAmount('0.1')
      setIsProcessing(false)
      setCurrentView('execution')
      return
    }

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

  if (!mounted) {
    return (
      <main className="min-h-screen bg-checkerboard flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="spinner-ring" />
          <span>Loading experience...</span>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-checkerboard">
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
              <div className="flex justify-end">
                <div className="flex justify-end">
                  <Wallet>
                    <ConnectWallet className="bg-gray-100 text-black hover:bg-gray-200 border border-gray-300">
                      <Avatar className="h-6 w-6" />
                      <Name className="text-black" />
                    </ConnectWallet>
                    <WalletDropdown className="bg-white border border-gray-200 text-black">
                      <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                        <Avatar />
                        <Name className="text-black font-bold" />
                        <Address className="text-gray-600" />
                        <EthBalance className="text-black" />
                      </Identity>
                      <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com" className="text-black hover:bg-gray-100">
                        Wallet
                      </WalletDropdownLink>
                      <WalletDropdownDisconnect className="text-black hover:bg-gray-100" />
                    </WalletDropdown>
                  </Wallet>
                </div>
              </div>
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
                  <div className="flex gap-2 justify-center">
                    <Wallet>
                      <ConnectWallet className="bg-gray-100 text-black hover:bg-gray-200 border border-gray-300">
                        <Avatar className="h-6 w-6" />
                        <Name className="text-black" />
                      </ConnectWallet>
                      <WalletDropdown className="bg-white border border-gray-200 text-black">
                        <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                          <Avatar />
                          <Name className="text-black font-bold" />
                          <Address className="text-gray-600" />
                          <EthBalance className="text-black" />
                        </Identity>
                        <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com" className="text-black hover:bg-gray-100">
                          Wallet
                        </WalletDropdownLink>
                        <WalletDropdownDisconnect className="text-black hover:bg-gray-100" />
                      </WalletDropdown>
                    </Wallet>
                  </div>
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
                    
                    {/* Digital Asset Box Title */}
                    <div className="relative mb-8 group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-hedge-green/20 to-emerald-500/20 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative bg-white ring-1 ring-gray-900/5 rounded-lg leading-none flex items-top justify-start space-x-6">
                            <div className="space-y-2 p-8 w-full bg-gradient-to-br from-white to-slate-50 rounded-lg border border-slate-100">
                                <div className="flex items-center space-x-3 mb-2">
                                    <div className="h-2 w-2 rounded-full bg-hedge-green animate-pulse"></div>
                                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">New Risk Assessment</h1>
                                </div>
                                <p className="text-slate-500">Define your business context to identify relevant market hedges.</p>
                                
                                {/* Decorative Corner Accents */}
                                <div className="absolute top-0 right-0 p-3">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-hedge-green/30">
                                        <path d="M1 1H6V3H3V6H1V1Z" fill="currentColor"/>
                                        <path d="M14 1H19V6H17V3H14V1Z" fill="currentColor"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

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
