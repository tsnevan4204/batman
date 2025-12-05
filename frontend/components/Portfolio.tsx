'use client'

import { useEffect, useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { ethers } from 'ethers'

const HEDGE_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_HEDGE_REGISTRY_ADDRESS || ''
const HEDGE_RECEIPT_NFT_ADDRESS = process.env.NEXT_PUBLIC_HEDGE_RECEIPT_NFT_ADDRESS || ''

interface Hedge {
  hedgeId: number
  user: string
  riskHash: string
  marketId: string
  amount: bigint
  tradeTxHash: string
  timestamp: bigint
  receiptTokenId: bigint
}

export default function Portfolio() {
  const { address } = useAccount()
  const [hedges, setHedges] = useState<Hedge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address || !HEDGE_REGISTRY_ADDRESS) {
      setLoading(false)
      return
    }

    loadHedges()
  }, [address])

  const loadHedges = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const abi = [
        'function getUserHedges(address user) external view returns (uint256[] memory)',
        'function getHedge(uint256 hedgeId) external view returns (tuple(address user, bytes32 riskHash, string marketId, uint256 amount, string tradeTxHash, uint256 timestamp, uint256 receiptTokenId))',
      ]

      const contract = new ethers.Contract(HEDGE_REGISTRY_ADDRESS, abi, provider)
      const hedgeIds = await contract.getUserHedges(address)

      const hedgePromises = hedgeIds.map((id: bigint) => contract.getHedge(id))
      const hedgeData = await Promise.all(hedgePromises)

      const formattedHedges = hedgeData.map((hedge: any, index: number) => ({
        hedgeId: Number(hedgeIds[index]),
        user: hedge.user,
        riskHash: hedge.riskHash,
        marketId: hedge.marketId,
        amount: hedge.amount,
        tradeTxHash: hedge.tradeTxHash,
        timestamp: hedge.timestamp,
        receiptTokenId: hedge.receiptTokenId,
      }))

      setHedges(formattedHedges)
    } catch (err) {
      console.error('Error loading hedges:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount: bigint) => {
    // USDC has 6 decimals
    const divisor = BigInt(10 ** 6)
    const whole = amount / divisor
    const fraction = amount % divisor
    return `${whole}.${fraction.toString().padStart(6, '0')}`
  }

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleString()
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Loading your hedges...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">My Hedges</h2>

      {hedges.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-4">No hedges found.</p>
          <p className="text-gray-400 text-sm">Start by creating a new hedge from the home page.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hedges.map((hedge) => (
            <div
              key={hedge.hedgeId}
              className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Hedge #{hedge.hedgeId}
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">Market ID: </span>
                      <span className="text-gray-900 font-mono text-xs bg-gray-100 px-1 rounded">{hedge.marketId}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Amount: </span>
                      <span className="text-gray-900 font-bold">
                        {formatAmount(hedge.amount)} USDC
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Date: </span>
                      <span className="text-gray-700">{formatDate(hedge.timestamp)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {hedge.receiptTokenId > 0 && (
                    <div className="mb-2">
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-bold rounded-full border border-blue-100">
                        NFT #{hedge.receiptTokenId.toString()}
                      </span>
                    </div>
                  )}
                  <a
                    href={`https://basescan.org/tx/${hedge.tradeTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center justify-end gap-1"
                  >
                    View Transaction <span>→</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

