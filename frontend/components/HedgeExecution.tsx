'use client'

import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { parseUnits } from 'viem'
import axios from 'axios'
import { ethers } from 'ethers'
import { Loader2, CheckCircle, Shield } from 'lucide-react'
import { burnUSDC, getAttestation, claimUSDC } from '@/lib/cctp'
import { switchToBaseSepolia, switchToPolygonAmoy } from '@/lib/network'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const HEDGE_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_HEDGE_REGISTRY_ADDRESS || ''
const DEMO_AMOUNT = '0.1' // hardcoded minimal amount (USDC, 6 decimals) for testnet/demo

// Force using wagmi's walletClient (OnchainKit/Base). Do not fall back to MetaMask.
const getEthersProvider = (walletClient?: any) => {
  // 1) Prefer wagmi walletClient (OnchainKit/Base)
  if (walletClient?.transport) {
    return new ethers.BrowserProvider(walletClient.transport, walletClient.chain?.id)
  }

  // 2) Fall back to injected providers, preferring Coinbase/Base
  const eth: any = (typeof window !== 'undefined' && (window as any).ethereum) || null
  if (eth?.providers?.length) {
    const cb = eth.providers.find(
      (p: any) => p.isCoinbaseWallet || p.isBaseWallet || p._state?.sentinel === 'OCK'
    )
    if (cb) return new ethers.BrowserProvider(cb)
    return new ethers.BrowserProvider(eth.providers[0])
  }
  if (eth) return new ethers.BrowserProvider(eth)

  throw new Error('Wallet provider not found. Please connect the Base/Coinbase wallet in the widget and retry.')
}


interface HedgeExecutionProps {
  riskDescription: string
  market: any
  amount: string
  onComplete: () => void
  onBack: () => void
}

type Step =
  | 'prepare'
  | 'bridge'
  | 'attestation'
  | 'claim'
  | 'trade'
  | 'record'
  | 'recording'
  | 'complete'
  | 'error'

export default function HedgeExecution({
  riskDescription,
  market,
  amount,
  onComplete,
  onBack,
}: HedgeExecutionProps) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [step, setStep] = useState<Step>('prepare')
  const [error, setError] = useState<string | null>(null)
  const [tradeTxHash, setTradeTxHash] = useState<string | null>(null)
  const [recordTxHash, setRecordTxHash] = useState<string | null>(null)
  const [orderData, setOrderData] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  const [bridgeTxHash, setBridgeTxHash] = useState<string | null>(null)
  const [bridgeMessageHash, setBridgeMessageHash] = useState<string | null>(null)
  const [bridgeMessage, setBridgeMessage] = useState<string | undefined>(undefined)
  const [attestation, setAttestation] = useState<string | null>(null)
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null)

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

  const handleExecute = async () => {
    try {
      setError(null)
      setIsSubmitting(true)

      // Step 1: Bridge USDC from Base Sepolia to Polygon Amoy
      setStep('bridge')
      await switchToBaseSepolia()

      // Use fixed minimal amount to avoid allowance/balance issues on testnet
      const amountWei = parseUnits(DEMO_AMOUNT, 6)
      const provider = getEthersProvider(walletClient)
      const signer = await provider.getSigner()

      const burn = await burnUSDC({
        signer,
        amount: amountWei,
        recipient: address as string,
      })

      setBridgeTxHash(burn.txHash)
      setBridgeMessageHash(burn.messageHash)
      setBridgeMessage(burn.message)

      // Step 2: Wait for Circle attestation
      setStep('attestation')
      let att: string | null = null
      for (let i = 0; i < 60; i++) {
        const res = await getAttestation(burn.messageHash)
        if (res.status === 'complete' && res.attestation) {
          att = res.attestation
          break
        }
        await sleep(10000) // 10s polling
      }
      if (!att) throw new Error('Circle attestation not ready yet')
      setAttestation(att)

      // Step 3: Claim on Polygon Amoy
      setStep('claim')
      await switchToPolygonAmoy()
      if (!burn.message) throw new Error('Bridge message missing; cannot claim')
      const claimHash = await claimUSDC({ signer, message: burn.message, attestation: att })
      setClaimTxHash(claimHash)

      // Step 4: Execute Polymarket order (dryRun on backend)
      setStep('trade')
      const limitPrice = market.currentPrice || 0.5
      const shares = limitPrice > 0 ? parseFloat(DEMO_AMOUNT) / limitPrice : 0

      const resp = await axios.post(`${API_BASE_URL}/api/execute-order`, {
        marketId: market.marketId,
        outcomeIndex: 0, // YES outcome
        side: 'buy',
        size: shares,
        limitPrice,
        dryRun: true,
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

      setTradeTxHash(tx || 'dry-run')

      // Step 5: Record on Base
      setStep('record')
      await switchToBaseSepolia()
      await handleRecordOnChain(tx || 'dry-run', burn.txHash, burn.messageHash)
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to execute hedge'
      setError(detail)
      console.error('Error executing hedge:', err)
      setStep('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRecordOnChain = async (
    tradeTx: string,
    bridgeTx: string,
    messageHash: string
  ) => {
    if (isRecording) return
    try {
      setError(null)
      setIsRecording(true)
      setStep('recording')

      const provider = getEthersProvider(walletClient)
      const signer = await provider.getSigner()

      const abi = [
        'function recordHedge(bytes32 riskHash, string calldata marketId, uint256 amount, string calldata tradeTxHash, string calldata bridgeTxHash, bytes32 bridgeMessageHash) external returns (uint256 receiptTokenId)',
      ]

      const contract = new ethers.Contract(HEDGE_REGISTRY_ADDRESS, abi, signer)
      const amountWei = parseUnits(DEMO_AMOUNT, 6)
      const riskHash = ethers.keccak256(ethers.toUtf8Bytes(riskDescription))

      const tx = await contract.recordHedge(
        riskHash,
        market.marketId,
        amountWei,
        tradeTx,
        bridgeTx,
        messageHash
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

        {/* Market Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-2">{market.title}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Amount: </span>
              <span className="text-gray-900 font-bold">{DEMO_AMOUNT} USDC</span>
            </div>
            <div>
              <span className="text-gray-500">Outcome: </span>
              <span className="text-gray-900 font-bold">YES</span>
            </div>
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
          {[
            { key: 'prepare', label: 'Prepare', active: step === 'prepare' },
            { key: 'bridge', label: 'Bridge USDC (Base → Polygon Amoy)', active: step === 'bridge' },
            { key: 'attestation', label: 'Wait for Circle Attestation', active: step === 'attestation' },
            { key: 'claim', label: 'Claim on Polygon Amoy', active: step === 'claim' },
            { key: 'trade', label: 'Polymarket Trade (dryRun)', active: step === 'trade' },
            { key: 'record', label: 'Record Hedge on Base', active: step === 'record' || step === 'recording' },
          ].map((s, idx) => (
            <div key={s.key} className={`flex items-center gap-3 ${s.active ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${s.active ? 'bg-blue-600' : 'bg-green-600'}`}>
                {idx + 1}
              </div>
              <span>{s.label}</span>
              {s.key === 'bridge' && bridgeTxHash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${bridgeTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 ml-auto"
                >
                  View burn tx
                </a>
              )}
              {s.key === 'claim' && claimTxHash && (
                <a
                  href={`https://www.oklink.com/amoy/tx/${claimTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 ml-auto"
                >
                  View claim tx
                </a>
              )}
              {s.key === 'record' && recordTxHash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${recordTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 ml-auto"
                >
                  View record tx
                </a>
              )}
            </div>
          ))}
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
            {isSubmitting ? 'Starting...' : 'Start Execution'}
          </button>
        )}

        {step === 'attestation' && (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600 mb-2">Waiting for Circle attestation (~15-20 min)</p>
            {bridgeMessageHash && (
              <p className="text-xs text-slate-500 break-all">messageHash: {bridgeMessageHash}</p>
            )}
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
            <p className="text-green-600 mb-4">Bridged, executed (dryRun), and recorded on Base.</p>
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
