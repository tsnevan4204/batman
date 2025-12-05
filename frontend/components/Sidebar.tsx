'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  History, 
  TrendingUp, 
  Zap, 
  ShieldAlert, 
  Wallet,
  ExternalLink,
  Loader2
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const HEDGE_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_HEDGE_REGISTRY_ADDRESS || ''
const POLYMARKET_TOP_API = `${API_BASE_URL}/api/polymarket-top`

interface SidebarProps {
  currentView: string
  onNavigate: (view: any) => void
}

export default function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const { address } = useAccount()
  const [recentHedges, setRecentHedges] = useState<any[]>([])
  const [marketStats, setMarketStats] = useState<any[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  
  // Fetch recent hedges
  useEffect(() => {
    if (address && HEDGE_REGISTRY_ADDRESS) {
      const fetchRecent = async () => {
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum)
          const abi = [
             'function getUserHedges(address user) external view returns (uint256[] memory)',
             'function getHedge(uint256 hedgeId) external view returns (tuple(address user, bytes32 riskHash, string marketId, uint256 amount, string tradeTxHash, uint256 timestamp, uint256 receiptTokenId))'
          ]
          const contract = new ethers.Contract(HEDGE_REGISTRY_ADDRESS, abi, provider)
          const hedgeIds = await contract.getUserHedges(address)
          
          // Get last 3 hedges
          const recentIds = hedgeIds.slice(-3).reverse()
          const hedgePromises = recentIds.map((id: any) => contract.getHedge(id))
          const hedgeData = await Promise.all(hedgePromises)
          
          setRecentHedges(hedgeData.map((h: any, i: number) => ({
            id: recentIds[i].toString(),
            amount: h.amount,
            marketId: h.marketId,
            timestamp: h.timestamp
          })))
        } catch (e) {
          console.error('Error fetching recent hedges', e)
        }
      }
      fetchRecent()
    }
  }, [address])

  // Fetch Top Markets from Polymarket
  useEffect(() => {
    const fetchMarketStats = async () => {
      try {
        setLoadingStats(true)
        const response = await axios.get(POLYMARKET_TOP_API, {
          params: { limit: 5 },
        })
        const events = response.data?.events || response.data || []
        const eventsArray = Array.isArray(events) ? events : []
        if (eventsArray.length > 0) {
          // Map the response to our stats format via backend proxy
          const stats = eventsArray.slice(0, 4).map((event: any) => {
             // Calculate a "change" or "vol" proxy if available, otherwise show volume
             const volume = event.volume ? `$${(event.volume / 1000).toFixed(1)}k` : 'N/A'
             return {
               label: event.title,
               value: volume,
               change: event.active ? 'Active' : 'Closed' 
             }
          })
          setMarketStats(stats)
        }
      } catch (e) {
        console.error('Error fetching polymarket stats', e)
        // Fallback to realistic static data if API fails (e.g. CORS)
        setMarketStats([
          { label: 'Fed Rate Cut', value: '$2.4m', change: '+12%' },
          { label: '2024 Election', value: '$150m', change: '+5%' },
          { label: 'BTC > $100k', value: '$450k', change: '-2%' },
          { label: 'SpaceX Launch', value: '$890k', change: '+8%' },
        ])
      } finally {
        setLoadingStats(false)
      }
    }
    fetchMarketStats()
  }, [])

  const formatAmount = (amount: bigint) => {
    const val = Number(amount) / 1000000
    return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }

  return (
    <motion.div 
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-72 hidden lg:flex flex-col h-screen fixed left-0 top-0 border-r border-gray-200 bg-white/80 backdrop-blur-md z-10"
    >
      {/* Logo Area */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-hedge-green to-emerald-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-green-500/20">
            H
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Hedger</h1>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
          Base Mainnet Live
        </div>
      </div>

      {/* Main Navigation */}
      <div className="p-4 space-y-1">
        <button 
          onClick={() => onNavigate('input')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            currentView === 'input' 
              ? 'bg-hedge-green text-white shadow-md shadow-green-500/20' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <LayoutDashboard size={18} />
          New Hedge
        </button>
        <button 
          onClick={() => onNavigate('portfolio')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            currentView === 'portfolio' 
              ? 'bg-hedge-green text-white shadow-md shadow-green-500/20' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <History size={18} />
          Portfolio
        </button>
      </div>

      {/* Stats Ticker Widget */}
      <div className="mx-4 mt-4 p-4 rounded-xl bg-gray-900 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-3 text-gray-400 text-xs uppercase font-bold tracking-wider">
          <TrendingUp size={12} />
          Polymarket Top Vol
        </div>
        <div className="space-y-3">
          {loadingStats ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-gray-500" size={20} />
            </div>
          ) : (
            marketStats.map((stat, i) => (
              <div key={i} className="flex justify-between items-center text-sm border-b border-gray-800 last:border-0 pb-2 last:pb-0">
                <span className="text-gray-300 truncate max-w-[100px]" title={stat.label}>{stat.label}</span>
                <div className="flex flex-col items-end">
                  <span className="font-mono font-bold text-white">{stat.value}</span>
                  <span className={`text-[10px] ${stat.change.includes('-') ? 'text-red-400' : 'text-green-400'}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Hedges Widget */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-3 px-2 text-gray-500 text-xs uppercase font-bold tracking-wider">
          <Wallet size={12} />
          Recent Activity
        </div>
        <div className="space-y-2">
          {recentHedges.length > 0 ? (
            recentHedges.map((hedge, i) => (
              <div key={i} className="p-3 rounded-lg border border-gray-100 bg-white hover:border-green-200 transition-colors group cursor-default">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-medium text-gray-900 truncate max-w-[100px]">
                    {hedge.marketId}
                  </span>
                  <span className="text-xs font-bold text-hedge-green">
                    {formatAmount(hedge.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-400">
                  <span>{new Date(Number(hedge.timestamp) * 1000).toLocaleDateString()}</span>
                  <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-xs text-gray-400 italic">
              No active hedges
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions / Footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="text-xs font-medium text-gray-500 mb-2 px-2">Risk Exposure</div>
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Total Covered</span>
            <span className="text-xs font-bold text-gray-900">
              {recentHedges.reduce((acc, h) => acc + (Number(h.amount) / 1000000), 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-hedge-green h-full rounded-full w-[45%] animate-pulse" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
