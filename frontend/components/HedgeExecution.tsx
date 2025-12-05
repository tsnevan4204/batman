'use client'

import { useState } from 'react'
import { parseUnits } from 'viem'
import axios from 'axios'
import { ethers } from 'ethers'
import { Loader2, CheckCircle, Shield } from 'lucide-react'
import { HedgePlan, HedgeLeg } from './StrategyModal'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const HEDGE_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_HEDGE_REGISTRY_ADDRESS || ''

interface HedgeExecutionProps {
  riskDescription: string
  plan: HedgePlan
  onComplete: () => void
  onBack: () => void
}

type Step = 'prepare' | 'submit' | 'record' | 'recording' | 'complete'

export default function HedgeExecution({
  riskDescription,
  plan,
  onComplete,
  onBack,
}: HedgeExecutionProps) {
  const [step, setStep] = useState<Step>('prepare')
  const [error, setError] = useState<string | null>(null)
  const [tradeTxHashes, setTradeTxHashes] = useState<string[]>([])
  const [recordTxHash, setRecordTxHash] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  const executeLeg = async (leg: HedgeLeg) => {
    const limitPrice = leg.hedgePrice || 0.5
    const shares = limitPrice > 0 ? leg.cost / limitPrice : 0
    const outcomeIndex = leg.side === 'Yes' ? 0 : 1

    const resp = await axios.post(`${API_BASE_URL}/api/execute-order`, {
      marketId: leg.marketId,
      outcomeIndex,
      side: 'buy',
      size: shares,
      limitPrice,
      dryRun: false,
    })

    const pm = resp.data?.response || {}
    const tx =
      pm.tradeTxHash ||
      pm.txHash ||
      pm.transactionHash ||
      pm.id ||
      pm.orderId ||
      null

    return { resp, tx }
  }

  const handleExecute = async () => {
    try {
      setError(null)
      setStep('submit')
      setIsSubmitting(true)
      const txs: string[] = []

      for (const leg of plan.legs) {
        const { resp, tx } = await executeLeg(leg)
        if (tx) {
          txs.push(tx)
        } else if (resp?.response?.dryRun) {
          txs.push('dry-run')
        }
      }

      setTradeTxHashes(txs)
      setStep('record')
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to execute hedge'
      setError(detail)
      console.error('Error executing hedge:', err)
      setStep('prepare')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRecordOnChain = async () => {
    if (isRecording) return
    
    try {
      setError(null)
      setIsRecording(true)
      setStep('recording')

      const riskHash = ethers.keccak256(ethers.toUtf8Bytes(riskDescription))
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()

      const abi = [
        'function recordHedge(bytes32 riskHash, string calldata marketId, uint256 amount, string calldata tradeTxHash) external returns (uint256 receiptTokenId)',
      ]

      const contract = new ethers.Contract(HEDGE_REGISTRY_ADDRESS, abi, signer)
      const totalCost = plan.totalCost.toFixed(2)
      const amountWei = parseUnits(totalCost, 6)

      const primaryMarketId = plan.legs[0]?.marketId || ''
      const primaryTx = tradeTxHashes[0] || ''

      const tx = await contract.recordHedge(
        riskHash,
        primaryMarketId,
        amountWei,
        primaryTx
      )

      setRecordTxHash(tx.hash)
      
      await tx.wait()
      setStep('complete')
      setTimeout(() => {
        onComplete()
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to record hedge on-chain')
      console.error('Error recording hedge:', err)
      setStep('record')
    } finally {
      setIsRecording(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="text-blue-600 hover:text-blue-800 mb-6 flex items-center gap-2 font-medium"
      >
        ← Back to Markets
      </button>

      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Execute Hedge</h2>

        {/* Plan Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Selected Plan: {plan.strategy}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Coverage: </span>
              <span className="text-gray-900 font-bold">{(plan.coverage * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-gray-500">Total Cost: </span>
              <span className="text-gray-900 font-bold">${plan.totalCost.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Risk Hedged: </span>
              <span className="text-gray-900 font-bold">${plan.totalRisk.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Legs: </span>
              <span className="text-gray-900 font-bold">{plan.legs.length}</span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {plan.legs.map((leg, idx) => (
              <div key={leg.marketId} className="flex justify-between text-xs bg-white rounded border border-gray-200 p-2">
                <div className="truncate max-w-[220px]">
                  <span className="font-semibold text-gray-800">Leg {idx + 1}:</span>{' '}
                  <span className="text-gray-700">{leg.title}</span>
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

        {/* Paymaster Info Banner */}
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <Shield className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-green-800 text-sm font-medium">Gas Sponsored by Coinbase Paymaster</p>
            <p className="text-green-600 text-xs">Recording your hedge on Base Sepolia is free!</p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-6">
          <div className={`flex items-center gap-3 ${step === 'prepare' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
              step === 'prepare' ? 'bg-blue-600' : 'bg-green-600'
            }`}>
              {step === 'prepare' ? '1' : <CheckCircle className="w-5 h-5" />}
            </div>
            <span>Prepare Orders</span>
          </div>

          <div className={`flex items-center gap-3 ${step === 'submit' ? 'text-blue-600 font-medium' : ['prepare'].includes(step) ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
              step === 'submit' ? 'bg-blue-600' : ['prepare'].includes(step) ? 'bg-gray-300' : 'bg-green-600'
            }`}>
              {['prepare', 'submit'].includes(step) ? '2' : <CheckCircle className="w-5 h-5" />}
            </div>
            <span>Submit to Polymarket</span>
          </div>

          <div className={`flex items-center gap-3 ${['record', 'recording'].includes(step) ? 'text-blue-600 font-medium' : ['prepare', 'submit'].includes(step) ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
              ['record', 'recording'].includes(step) ? 'bg-blue-600' : ['prepare', 'submit'].includes(step) ? 'bg-gray-300' : 'bg-green-600'
            }`}>
              {step === 'recording' ? <Loader2 className="w-5 h-5 animate-spin" /> : 
               step === 'complete' ? <CheckCircle className="w-5 h-5" /> : '3'}
            </div>
            <span>Record on Base (Sponsored)</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {step === 'prepare' && (
          <button
            onClick={handleExecute}
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-hedge-green hover:bg-hedge-green-dark text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Start Execution'}
          </button>
        )}

        {step === 'submit' && (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600 mb-4">Submitting bundled orders to Polymarket...</p>
          </div>
        )}

        {step === 'record' && tradeTxHashes.length > 0 && (
          <div>
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium mb-2">Orders executed!</p>
              <div className="text-sm text-green-700 space-y-1">
                {tradeTxHashes.map((tx, idx) => (
                  <div key={idx} className="break-all">
                    Leg {idx + 1}: {tx}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleRecordOnChain}
              disabled={isRecording}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isRecording ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Hedge on Base (Gas Free)'
              )}
            </button>
          </div>
        )}

        {step === 'recording' && (
          <div className="text-center p-8 bg-blue-50 rounded-lg border border-blue-200">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-blue-800 font-medium mb-2">Recording hedge on Base...</p>
            <p className="text-blue-600 text-sm">Gas is being sponsored by Coinbase Paymaster</p>
            {recordTxHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${recordTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs mt-2 inline-block"
              >
                View on BaseScan →
              </a>
            )}
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-green-800 text-lg font-bold mb-2">Hedge Complete!</p>
            <p className="text-green-600 mb-4">Your hedge has been recorded and NFT receipt minted.</p>
            {recordTxHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${recordTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                View Transaction on BaseScan →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
