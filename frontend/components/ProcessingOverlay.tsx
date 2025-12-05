'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, Search } from 'lucide-react'

interface ProcessingOverlayProps {
  isVisible: boolean
  riskDescription: string
}

const STEPS = [
  "Analyzing risk dimensions...",
  "Querying Polymarket API...",
  "Filtering irrelevant markets...",
  "Calculating correlation metrics...",
  "Structuring hedge packages..."
]

// Fake markets for the scanning animation
const SCANNED_MARKETS = [
  { title: "Fed Rates > 5.5% by Dec", match: false },
  { title: "WTI Oil > $90 Q3", match: true },
  { title: "SpaceX Launch Success", match: false },
  { title: "Global Supply Chain Index > 4.0", match: true },
  { title: "Bitcoin > $100k 2024", match: false },
  { title: "Eurozone Inflation < 2%", match: false },
]

export default function ProcessingOverlay({ isVisible, riskDescription }: ProcessingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [scannedIdx, setScannedIdx] = useState(0)

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0)
      setScannedIdx(0)
      return
    }

    // Cycle through text steps
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % STEPS.length)
    }, 2000)

    // Cycle through scanned markets
    const marketInterval = setInterval(() => {
      setScannedIdx(prev => prev + 1)
    }, 800)

    return () => {
      clearInterval(stepInterval)
      clearInterval(marketInterval)
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-xl"
    >
      <div className="max-w-2xl w-full p-8 flex flex-col items-center">
        {/* Spinner & Main Status */}
        <div className="relative mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 rounded-full border-4 border-gray-100 border-t-hedge-green"
          />
          <div className="absolute inset-0 flex items-center justify-center">
             <Search className="text-hedge-green w-8 h-8 animate-pulse" />
          </div>
        </div>

        <motion.h2
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-2xl font-bold text-gray-900 mb-2 text-center h-8"
        >
          {STEPS[currentStep]}
        </motion.h2>
        
        <p className="text-gray-500 mb-12 text-center max-w-md">
          Using AI to match your business context with liquid prediction markets.
        </p>

        {/* Market Scanning Visualization */}
        <div className="w-full relative h-48 overflow-hidden mask-image-gradient">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white z-10 pointer-events-none" />
          
          <div className="flex flex-col items-center gap-4">
            <AnimatePresence mode='popLayout'>
              {SCANNED_MARKETS.map((market, i) => {
                // Show a window of markets based on time
                const isActive = i === scannedIdx % SCANNED_MARKETS.length
                const isPast = i < scannedIdx % SCANNED_MARKETS.length
                
                // Only show if close to current index
                if (Math.abs(i - (scannedIdx % SCANNED_MARKETS.length)) > 2) return null

                return (
                  <motion.div
                    key={`${market.title}-${i}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ 
                      opacity: isActive ? 1 : 0.5, 
                      scale: isActive ? 1.05 : 0.95,
                      y: 0,
                      filter: isActive ? 'blur(0px)' : 'blur(2px)'
                    }}
                    exit={{ opacity: 0, y: -50, scale: 0.9 }}
                    className={`
                      flex items-center justify-between w-full max-w-md p-4 rounded-xl border 
                      ${isActive ? 'bg-white shadow-xl border-gray-200 z-20' : 'bg-gray-50 border-gray-100 z-0'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />
                      <span className={`font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                        {market.title}
                      </span>
                    </div>
                    
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        {market.match ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-hedge-green bg-green-50 px-2 py-1 rounded-full">
                            <CheckCircle2 size={14} /> Match
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                            <XCircle size={14} /> Skip
                          </span>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

