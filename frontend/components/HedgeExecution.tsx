'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { parseUnits } from 'viem'
import axios from 'axios'
import { ethers } from 'ethers'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const HEDGE_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_HEDGE_REGISTRY_ADDRESS || ''

interface HedgeExecutionProps {
  riskDescription: string
  market: any
  amount: string
  onComplete: () => void
  onBack: () => void
}

export default function HedgeExecution({
  riskDescription,
  market,
  amount,
  onComplete,
  onBack,
}: HedgeExecutionProps) {
  const { address } = useAccount()
  const [step, setStep] = useState<'prepare' | 'sign' | 'submit' | 'record' | 'complete'>('prepare')
  const [error, setError] = useState<string | null>(null)
  const [tradeTxHash, setTradeTxHash] = useState<string | null>(null)
  const [orderData, setOrderData] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleExecute = async () => {
    try {
      setError(null)
      setStep('submit')
      setIsSubmitting(true)

      const limitPrice = market.currentPrice || 0.5
      const shares = limitPrice > 0 ? parseFloat(amount) / limitPrice : 0

      const resp = await axios.post(`${API_BASE_URL}/api/execute-order`, {
        marketId: market.marketId,
        outcomeIndex: 0, // YES outcome
        side: 'buy',
        size: shares,
        limitPrice,
        dryRun: false,
      })

      setOrderData(resp.data)

      const pm = resp.data?.response || {}
      const tx =
        pm.tradeTxHash ||
        pm.txHash ||
        pm.transactionHash ||
        pm.id ||
        pm.orderId ||
        null

      if (tx) {
        setTradeTxHash(tx)
        setStep('record')
      } else if (resp.data?.response?.dryRun) {
        setTradeTxHash('dry-run')
        setStep('record')
      } else {
        throw new Error('No transaction hash returned from executor')
      }
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
    try {
      setError(null)

      // Compute risk hash
      const riskHash = ethers.keccak256(ethers.toUtf8Bytes(riskDescription))

      // Call recordHedge on contract
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()

      // ABI for recordHedge function
      const abi = [
        'function recordHedge(bytes32 riskHash, string calldata marketId, uint256 amount, string calldata tradeTxHash) external returns (uint256 receiptTokenId)',
      ]

      const contract = new ethers.Contract(HEDGE_REGISTRY_ADDRESS, abi, signer)

      // Convert amount to USDC units (6 decimals)
      const amountWei = parseUnits(amount, 6)

      const tx = await contract.recordHedge(
        riskHash,
        market.marketId,
        amountWei,
        tradeTxHash
      )

      await tx.wait()
      setStep('complete')
      setTimeout(() => {
        onComplete()
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to record hedge on-chain')
      console.error('Error recording hedge:', err)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="text-blue-400 hover:text-blue-300 mb-6 flex items-center gap-2"
      >
        ← Back to Markets
      </button>

      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Execute Hedge</h2>

        {/* Market Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-2">{market.title}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Amount: </span>
              <span className="text-gray-900 font-bold">{amount} USDC</span>
            </div>
            <div>
              <span className="text-gray-500">Outcome: </span>
              <span className="text-gray-900 font-bold">YES</span>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-6">
          <div className={`flex items-center gap-3 ${step === 'prepare' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
              step === 'prepare' ? 'bg-blue-600' : 'bg-gray-300'
            }`}>
              1
            </div>
            <span>Prepare Order</span>
          </div>

          <div className={`flex items-center gap-3 ${step === 'sign' ? 'text-blue-600 font-medium' : step === 'prepare' ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
              step === 'sign' ? 'bg-blue-600' : step === 'prepare' ? 'bg-gray-300' : 'bg-green-600'
            }`}>
              2
            </div>
            <span>Sign Order</span>
          </div>

          <div className={`flex items-center gap-3 ${step === 'submit' ? 'text-blue-600 font-medium' : ['prepare', 'sign'].includes(step) ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
              step === 'submit' ? 'bg-blue-600' : ['prepare', 'sign'].includes(step) ? 'bg-gray-300' : 'bg-green-600'
            }`}>
              3
            </div>
            <span>Submit to Polymarket</span>
          </div>

          <div className={`flex items-center gap-3 ${step === 'record' ? 'text-blue-600 font-medium' : ['prepare', 'sign', 'submit'].includes(step) ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
              step === 'record' ? 'bg-blue-600' : ['prepare', 'sign', 'submit'].includes(step) ? 'bg-gray-300' : 'bg-green-600'
            }`}>
              4
            </div>
            <span>Record on Base</span>
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

        {step === 'sign' && (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 mb-4 animate-pulse">Please sign the order in your wallet...</p>
          </div>
        )}

        {step === 'submit' && (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 mb-4 animate-pulse">Submitting order to Polymarket...</p>
          </div>
        )}

        {step === 'record' && tradeTxHash && (
          <div>
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium mb-2">Trade executed successfully!</p>
              <p className="text-sm text-green-600 break-all">
                Transaction: {tradeTxHash}
              </p>
            </div>
            <button
              onClick={handleRecordOnChain}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Record Hedge on Base
            </button>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-lg font-bold mb-2">✓ Hedge Complete!</p>
            <p className="text-green-600">Your hedge has been recorded and NFT receipt minted.</p>
          </div>
        )}
      </div>
    </div>
  )
}

