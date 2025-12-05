'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { ethers, formatUnits } from 'ethers'
import PortfolioMetrics from './PortfolioMetrics'
import PortfolioCharts from './PortfolioCharts'
import { ExternalLink, CheckCircle, XCircle, Clock, Trophy } from 'lucide-react'

const HEDGE_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_HEDGE_REGISTRY_ADDRESS || ''

interface Hedge {
  hedgeId: number
  user: string
  riskHash: string
  marketId: string
  amount: bigint
  tradeTxHash: string
  timestamp: bigint
  receiptTokenId: bigint
  // Mock/enriched fields
  status: 'Active' | 'Won' | 'Lost'
  payout: string
  question: string
  riskDescription: string
}

export default function Portfolio() {
  const { address } = useAccount()
  const [hedges, setHedges] = useState<Hedge[]>([])
  const [loading, setLoading] = useState(true)
  
  // Derived metrics
  const [tvl, setTvl] = useState('0')
  const [pnl, setPnl] = useState('0')
  const [activeCount, setActiveCount] = useState(0)
  const [winRate, setWinRate] = useState(0)

  useEffect(() => {
    if (!address || !HEDGE_REGISTRY_ADDRESS) {
      setLoading(false)
      return
    }
    loadHedges()
  }, [address])

  const loadHedges = async () => {
    try {
      // 1. Fetch from contract
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const abi = [
        'function getUserHedges(address user) external view returns (uint256[] memory)',
        'function getHedge(uint256 hedgeId) external view returns (tuple(address user, bytes32 riskHash, string marketId, uint256 amount, string tradeTxHash, uint256 timestamp, uint256 receiptTokenId))',
      ]
      const contract = new ethers.Contract(HEDGE_REGISTRY_ADDRESS, abi, provider)
      const hedgeIds = await contract.getUserHedges(address)

      const hedgePromises = hedgeIds.map((id: bigint) => contract.getHedge(id))
      const hedgeData = await Promise.all(hedgePromises)

      // 2. Mock/Enrich Data
      let totalValue = 0
      let totalPnl = 0
      let wonCount = 0
      let settledCount = 0
      
      const formattedHedges = hedgeData.map((hedge: any, index: number) => {
        // Mock Status & Resolution (Random for demo purposes)
        // In real app: fetch from backend/Polymarket API
        const isSettled = index % 3 === 0 // Every 3rd hedge is settled
        const isWon = isSettled && index % 2 === 0 // 50% win rate on settled
        
        const status = !isSettled ? 'Active' : (isWon ? 'Won' : 'Lost')
        
        const amountUSDC = Number(formatUnits(hedge.amount, 6))
        totalValue += status === 'Active' ? amountUSDC : 0
        
        // Mock PnL
        if (isSettled) {
          settledCount++
          if (isWon) {
            wonCount++
            totalPnl += amountUSDC * 0.85 // 85% return example
          } else {
            totalPnl -= amountUSDC
          }
        }

        return {
          hedgeId: Number(hedgeIds[index]),
          user: hedge.user,
          riskHash: hedge.riskHash,
          marketId: hedge.marketId,
          amount: hedge.amount,
          tradeTxHash: hedge.tradeTxHash,
          timestamp: hedge.timestamp,
          receiptTokenId: hedge.receiptTokenId,
          status,
          payout: isWon ? `$${(amountUSDC * 1.85).toFixed(2)}` : '-',
          question: `Polymarket Prediction #${hedge.marketId.substring(0, 8)}...`, // Mock question
          riskDescription: "Supply Chain Disruption Risk" // Mock description (hash is on-chain)
        }
      })

      setHedges(formattedHedges.reverse()) // Newest first
      
      // Update Metrics
      setTvl(`$${totalValue.toLocaleString()}`)
      setPnl(`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString()}`)
      setActiveCount(formattedHedges.filter((h: any) => h.status === 'Active').length)
      setWinRate(settledCount > 0 ? Math.round((wonCount / settledCount) * 100) : 0)

    } catch (err) {
      console.error('Error loading hedges:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount: bigint) => {
    return Number(formatUnits(amount, 6)).toLocaleString()
  }

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="spinner-ring" />
          <span>Loading portfolio data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Portfolio Overview</h2>
        <p className="text-slate-500">Track your active risk positions and historical performance.</p>
      </div>

      {/* 1. Headline Metrics */}
      <PortfolioMetrics 
        tvl={tvl}
        pnl={pnl}
        activeHedges={activeCount}
        winRate={winRate}
      />

      {/* 2. Charts Area */}
      <PortfolioCharts />

      {/* 3. Detailed Hedge Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900">Hedge History</h3>
          <button className="text-sm text-blue-600 font-medium hover:text-blue-700">Export CSV</button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Context</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Market</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Payout</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hedges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No hedges recorded yet.
                  </td>
                </tr>
              ) : (
                hedges.map((hedge) => (
                  <tr key={hedge.hedgeId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(hedge.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                      {hedge.riskDescription}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-[200px] truncate" title={hedge.question}>
                      {hedge.question}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 font-bold">
                      ${formatAmount(hedge.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                        ${hedge.status === 'Active' ? 'bg-blue-50 text-blue-700' : 
                          hedge.status === 'Won' ? 'bg-green-50 text-green-700' : 
                          'bg-slate-100 text-slate-600'}`}>
                        {hedge.status === 'Active' && <Clock className="w-3 h-3" />}
                        {hedge.status === 'Won' && <Trophy className="w-3 h-3" />}
                        {hedge.status === 'Lost' && <XCircle className="w-3 h-3" />}
                        {hedge.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                      {hedge.payout}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {hedge.status === 'Won' && (
                          <a
                            href={`https://polymarket.com/market/${hedge.marketId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center gap-1"
                          >
                            Claim <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <a
                          href={`https://basescan.org/tx/${hedge.tradeTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="View on BaseScan"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
