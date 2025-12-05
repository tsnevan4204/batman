'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'
import { motion } from 'framer-motion'
import { formatUnits } from 'ethers'

interface Hedge {
  hedgeId: number
  amount: bigint
  timestamp: bigint
  marketId: string
  status: 'Active' | 'Won' | 'Lost'
}

interface PortfolioChartsProps {
  hedges: Hedge[]
}

const COLORS = ['#0FA958', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6']

export default function PortfolioCharts({ hedges }: PortfolioChartsProps) {
  // Compute portfolio value over time from hedge data
  const getTimelineData = () => {
    if (hedges.length === 0) {
      return [{ name: 'Now', value: 0 }]
    }

    // Sort hedges by timestamp
    const sorted = [...hedges].sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
    
    // Build cumulative timeline
    let cumulative = 0
    const timeline = sorted.map((hedge, index) => {
      const amount = Number(formatUnits(hedge.amount, 6))
      cumulative += amount
      const date = new Date(Number(hedge.timestamp) * 1000)
      return {
        name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.round(cumulative),
        hedgeId: hedge.hedgeId
      }
    })

    return timeline
  }

  // Compute market distribution from hedge data
  const getMarketDistribution = () => {
    if (hedges.length === 0) {
      return [{ name: 'No Data', value: 1, color: '#E2E8F0' }]
    }

    // Group by marketId (truncated for display)
    const marketTotals: Record<string, number> = {}
    hedges.forEach(hedge => {
      const marketKey = hedge.marketId.substring(0, 8) + '...'
      const amount = Number(formatUnits(hedge.amount, 6))
      marketTotals[marketKey] = (marketTotals[marketKey] || 0) + amount
    })

    return Object.entries(marketTotals)
      .map(([name, value], index) => ({
        name,
        value: Math.round(value),
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5) // Top 5 markets
  }

  // Compute status breakdown
  const getStatusBreakdown = () => {
    const statusCounts = { Active: 0, Won: 0, Lost: 0 }
    hedges.forEach(hedge => {
      statusCounts[hedge.status]++
    })
    
    return [
      { name: 'Active', value: statusCounts.Active, color: '#3B82F6' },
      { name: 'Won', value: statusCounts.Won, color: '#0FA958' },
      { name: 'Lost', value: statusCounts.Lost, color: '#EF4444' },
    ].filter(item => item.value > 0)
  }

  const timelineData = getTimelineData()
  const marketData = getMarketDistribution()
  const statusData = getStatusBreakdown()

  // If no hedges, show empty state
  if (hedges.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 bg-white rounded-xl p-12 shadow-sm border border-slate-100 text-center"
        >
          <p className="text-slate-500">No hedge data to display yet. Execute your first hedge to see analytics.</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Portfolio Value Chart */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Cumulative Hedge Value</h3>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">From Contract</span>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0FA958" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#0FA958" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total Value']}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#0FA958" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Status Breakdown */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-slate-100"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Hedge Status</h3>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">{hedges.length} Total</span>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData.length > 0 ? statusData : [{ name: 'No Data', value: 1, color: '#E2E8F0' }]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {(statusData.length > 0 ? statusData : [{ color: '#E2E8F0' }]).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, 'Hedges']} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                formatter={(value) => <span className="text-slate-600 text-sm ml-2">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  )
}
