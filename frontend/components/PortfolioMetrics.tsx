import { motion } from 'framer-motion'
import { TrendingUp, AlertCircle, CheckCircle, Activity } from 'lucide-react'

interface PortfolioMetricsProps {
  tvl: string
  pnl: string
  activeHedges: number
  winRate: number
}

export default function PortfolioMetrics({ tvl, pnl, activeHedges, winRate }: PortfolioMetricsProps) {
  const metrics = [
    {
      label: 'Total Value Locked',
      value: tvl,
      change: '+12.5%',
      icon: Activity,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      isPositive: true
    },
    {
      label: 'Total PnL',
      value: pnl,
      change: '+8.2%',
      icon: TrendingUp,
      color: 'text-green-500',
      bg: 'bg-green-50',
      isPositive: true
    },
    {
      label: 'Active Hedges',
      value: activeHedges.toString(),
      change: '2 pending',
      icon: AlertCircle,
      color: 'text-orange-500',
      bg: 'bg-orange-50',
      isPositive: true
    },
    {
      label: 'Win Rate',
      value: `${winRate}%`,
      change: 'Last 30 days',
      icon: CheckCircle,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      isPositive: true
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{metric.label}</p>
              <h3 className="text-2xl font-bold text-slate-900">{metric.value}</h3>
            </div>
            <div className={`p-2 rounded-lg ${metric.bg}`}>
              <metric.icon className={`w-5 h-5 ${metric.color}`} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className={metric.isPositive ? 'text-green-600' : 'text-red-600'}>
              {metric.change}
            </span>
            <span className="text-slate-400 ml-2">vs last month</span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

