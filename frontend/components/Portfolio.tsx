'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { ethers, formatUnits } from 'ethers'
import PortfolioMetrics from './PortfolioMetrics'
import PortfolioCharts from './PortfolioCharts'
import { ExternalLink, Clock, Trophy, XCircle, RefreshCw, Database } from 'lucide-react'
import { HEDGE_REGISTRY_ADDRESS } from '@/constants/addresses'

interface Hedge {
  hedgeId: number
  user: string
  riskHash: string
  marketId: string
  amount: bigint
  tradeTxHash: string
  timestamp: bigint
  receiptTokenId: bigint
  // Enriched fields (from contract or mock until settlement is added)
  status: 'Active' | 'Won' | 'Lost'
  payout: string
  question: string
  riskDescription: string
}

export default function Portfolio() {
  const { address } = useAccount()
  const [hedges, setHedges] = useState<Hedge[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalHedgeCount, setTotalHedgeCount] = useState(0)
  
  // Derived metrics
  const [tvl, setTvl] = useState('$0')
  const [pnl, setPnl] = useState('$0')
  const [activeCount, setActiveCount] = useState(0)
  const [winRate, setWinRate] = useState(0)

  useEffect(() => {
    if (!address) {
      setLoading(false)
      return
    }
    
    if (!HEDGE_REGISTRY_ADDRESS) {
      setError('HedgeRegistry contract address not configured')
      setLoading(false)
      return
    }
    
    loadHedges()
  }, [address])

  const loadHedges = async () => {
    try {
      setError(null)
      
      // Fetch from HedgeRegistry contract on Base Sepolia
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const code = await provider.getCode(HEDGE_REGISTRY_ADDRESS)
      if (!code || code === '0x') {
        setError('HedgeRegistry address might be wrong or not deployed on this network.')
        setLoading(false)
        setRefreshing(false)
        return
      }
      
      const abi = [
        'function getUserHedges(address user) external view returns (uint256[] memory)',
        'function getHedge(uint256 hedgeId) external view returns (tuple(address user, bytes32 riskHash, string marketId, uint256 amount, string tradeTxHash, uint256 timestamp, uint256 receiptTokenId))',
        'function getHedgeCount() external view returns (uint256)',
      ]
      
      const contract = new ethers.Contract(HEDGE_REGISTRY_ADDRESS, abi, provider)
      
      // Get total hedge count (global)
      try {
        const totalCount = await contract.getHedgeCount()
        setTotalHedgeCount(Number(totalCount))
      } catch (e: any) {
        console.log('getHedgeCount not available:', e)
        setTotalHedgeCount(0)
        setError('HedgeRegistry address might be wrong or not deployed on this network.')
        setLoading(false)
        setRefreshing(false)
        return
      }

      // Get user's hedges
      const hedgeIds = await contract.getUserHedges(address)
      
      if (hedgeIds.length === 0) {
        setHedges([])
        setTvl('$0')
        setPnl('$0')
        setActiveCount(0)
        setWinRate(0)
        return
      }

      const hedgePromises = hedgeIds.map((id: bigint) => contract.getHedge(id))
      const hedgeData = await Promise.all(hedgePromises)

      // Process hedge data from contract
      let totalValue = 0
      let totalPnl = 0
      let wonCount = 0
      let settledCount = 0
      
      const formattedHedges = hedgeData.map((hedge: any, index: number) => {
        // Until settlement fields are added to contract, all hedges are "Active"
        // Once you add settlement fields, read status from contract instead
        const status: 'Active' | 'Won' | 'Lost' = 'Active'
        
        const amountUSDC = Number(formatUnits(hedge.amount, 6))
        totalValue += amountUSDC
        
        // Truncate riskHash for display
        const riskHashStr = hedge.riskHash.toString()
        const riskDescription = `Risk #${riskHashStr.substring(0, 10)}...`

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
          payout: '-', // Will show actual payout once settlement is on-chain
          question: `Market: ${hedge.marketId.substring(0, 12)}...`,
          riskDescription,
        }
      })

      setHedges(formattedHedges.reverse()) // Newest first
      
      // Update Metrics from on-chain data
      setTvl(`$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      setPnl('$0') // Until settlement is tracked on-chain
      setActiveCount(formattedHedges.length)
      setWinRate(settledCount > 0 ? Math.round((wonCount / settledCount) * 100) : 0)

    } catch (err: any) {
      console.error('Error loading hedges from contract:', err)
      setError(err.message || 'Failed to load hedges from contract')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadHedges()
  }

  const formatAmount = (amount: bigint) => {
    return Number(formatUnits(amount, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="spinner-ring" />
          <span>Loading portfolio from Base Sepolia...</span>
        </div>
      </div>
    )
  }

  if (!address) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <p className="text-slate-500 mb-2">Connect your wallet to view portfolio</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Portfolio Overview</h2>
          <p className="text-slate-500">Track your active risk positions from HedgeRegistry on Base Sepolia.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            <Database className="w-3 h-3" />
            <span>Contract: {HEDGE_REGISTRY_ADDRESS.substring(0, 6)}...{HEDGE_REGISTRY_ADDRESS.substring(38)}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* 1. Headline Metrics */}
      <PortfolioMetrics 
        tvl={tvl}
        pnl={pnl}
        activeHedges={activeCount}
        winRate={winRate}
      />

      {/* 2. Charts Area - Pass hedge data */}
      <PortfolioCharts hedges={hedges} />

      {/* 3. Detailed Hedge Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Hedge History</h3>
            <p className="text-xs text-slate-500 mt-1">
              {hedges.length} hedges from contract • {totalHedgeCount > 0 ? `${totalHedgeCount} total on-chain` : ''}
            </p>
          </div>
          <a
            href={`https://sepolia.basescan.org/address/${HEDGE_REGISTRY_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
          >
            View Contract <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Hash</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Market</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">NFT</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hedges.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No hedges recorded yet. Execute your first hedge to see it here.
                  </td>
                </tr>
              ) : (
                hedges.map((hedge) => (
                  <tr key={hedge.hedgeId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-900 font-mono">
                      #{hedge.hedgeId}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(hedge.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono text-xs">
                      {hedge.riskHash.toString().substring(0, 10)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono text-xs max-w-[150px] truncate" title={hedge.marketId}>
                      {hedge.marketId.substring(0, 16)}...
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
                    <td className="px-6 py-4 text-sm">
                      {hedge.receiptTokenId > 0 ? (
                        <span className="text-purple-600 font-medium">#{hedge.receiptTokenId.toString()}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
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
                          href={`https://sepolia.basescan.org/tx/${hedge.tradeTxHash}`}
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
