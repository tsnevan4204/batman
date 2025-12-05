'use client'

import { useState } from 'react'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ExpenseItem {
  name: string
  amount: string
  sensitivity: string
}

export interface RiskDetails {
  businessOverview: string
  specificRisk: string
  expenses: ExpenseItem[]
}

interface RiskInputProps {
  onMatch: (description: string, markets: any[], details: RiskDetails) => void
}

export default function RiskInput({ onMatch }: RiskInputProps) {
  const [businessOverview, setBusinessOverview] = useState('')
  const [specificRisk, setSpecificRisk] = useState('')
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { name: '', amount: '', sensitivity: '' }
  ])
  const [showExpenses, setShowExpenses] = useState(false)
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addExpense = () => {
    setExpenses([...expenses, { name: '', amount: '', sensitivity: '' }])
  }

  const updateExpense = (index: number, field: keyof ExpenseItem, value: string) => {
    const newExpenses = [...expenses]
    newExpenses[index][field] = value
    setExpenses(newExpenses)
  }

  const removeExpense = (index: number) => {
    if (expenses.length > 1) {
      const newExpenses = expenses.filter((_, i) => i !== index)
      setExpenses(newExpenses)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessOverview.trim() || !specificRisk.trim()) {
      setError('Please fill in the required fields.')
      return
    }

    setIsLoading(true)
    setError(null)

    // Construct composite description for the AI backend
    let compositeDescription = `Business Context: ${businessOverview}\n\nSpecific Risk: ${specificRisk}`
    
    const validExpenses = expenses.filter(e => e.name && e.amount)
    if (validExpenses.length > 0) {
      compositeDescription += `\n\nKey Exposures:`
      validExpenses.forEach(exp => {
        compositeDescription += `\n- ${exp.name}: $${exp.amount}/mo (Sensitivity: ${exp.sensitivity}%)`
      })
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/match-risk`, {
        risk_description: compositeDescription,
      })

      if (response.data.matches && response.data.matches.length > 0) {
        onMatch(compositeDescription, response.data.matches, {
          businessOverview,
          specificRisk,
          expenses: validExpenses
        })
      } else {
        setError('No matching markets found. Try refining your risk description.')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to match risk. Please try again.')
      console.error('Error matching risk:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-white/50 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-green-50 to-blue-50 rounded-full blur-3xl opacity-50 -z-10 pointer-events-none" />
        
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Business Profile
          </h2>
          <p className="text-gray-600">
            Describe your business context and specific risks to find tailored hedge markets.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section A: Business Overview */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Business Overview <span className="text-hedge-green">*</span>
            </label>
            <div className="relative group">
              <input
                type="text"
                value={businessOverview}
                onChange={(e) => setBusinessOverview(e.target.value)}
                placeholder="e.g. We operate an e-commerce business heavily dependent on international shipping."
                className="w-full p-4 bg-white/50 hover:bg-white text-gray-900 rounded-lg border border-gray-200 group-hover:border-hedge-green/50 focus:border-hedge-green focus:ring-4 focus:ring-hedge-green/10 focus:outline-none transition-all placeholder:text-gray-400 shadow-sm"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Section B: Specific Risk */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Specific Risk Description <span className="text-hedge-green">*</span>
            </label>
            <div className="relative group">
              <textarea
                value={specificRisk}
                onChange={(e) => setSpecificRisk(e.target.value)}
                placeholder="e.g. If shipping costs increase by more than 20% next quarter, margins decline significantly."
                className="w-full h-32 p-4 bg-white/50 hover:bg-white text-gray-900 rounded-lg border border-gray-200 group-hover:border-hedge-green/50 focus:border-hedge-green focus:ring-4 focus:ring-hedge-green/10 focus:outline-none transition-all resize-none placeholder:text-gray-400 shadow-sm"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Section C: Optional Metrics */}
          <div className="border border-gray-200/60 rounded-lg overflow-hidden bg-white/30">
            <button
              type="button"
              onClick={() => setShowExpenses(!showExpenses)}
              className="w-full flex justify-between items-center p-4 hover:bg-white/50 transition-colors"
            >
              <span className="font-medium text-gray-700 flex items-center gap-2">
                <span className={`w-5 h-5 flex items-center justify-center rounded border ${showExpenses ? 'border-hedge-green text-hedge-green bg-green-50' : 'border-gray-300 text-gray-400'}`}>
                  {showExpenses ? '−' : '+'}
                </span>
                Add Structured Metrics (Optional)
              </span>
              <span className="text-sm text-gray-500">Expenses & Sensitivities</span>
            </button>

            {showExpenses && (
              <div className="p-4 bg-white/50 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-12 gap-4 mb-2 text-xs font-semibold text-gray-500 uppercase">
                  <div className="col-span-5">Expense Name</div>
                  <div className="col-span-3">Monthly Spend</div>
                  <div className="col-span-3">Sensitivity (%)</div>
                  <div className="col-span-1"></div>
                </div>
                
                {expenses.map((expense, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={expense.name}
                        onChange={(e) => updateExpense(idx, 'name', e.target.value)}
                        placeholder="e.g. Shipping"
                        className="w-full p-2 bg-white border border-gray-200 rounded focus:border-hedge-green focus:outline-none text-sm text-gray-900 shadow-sm"
                      />
                    </div>
                    <div className="col-span-3 relative">
                      <span className="absolute left-2 top-2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        value={expense.amount}
                        onChange={(e) => updateExpense(idx, 'amount', e.target.value)}
                        placeholder="0"
                        className="w-full p-2 pl-5 bg-white border border-gray-200 rounded focus:border-hedge-green focus:outline-none text-sm text-gray-900 shadow-sm"
                      />
                    </div>
                    <div className="col-span-3 relative">
                      <input
                        type="number"
                        value={expense.sensitivity}
                        onChange={(e) => updateExpense(idx, 'sensitivity', e.target.value)}
                        placeholder="20"
                        className="w-full p-2 pr-6 bg-white border border-gray-200 rounded focus:border-hedge-green focus:outline-none text-sm text-gray-900 shadow-sm"
                      />
                      <span className="absolute right-2 top-2 text-gray-400 text-sm">%</span>
                    </div>
                    <div className="col-span-1 text-center">
                      {expenses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeExpense(idx)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addExpense}
                  className="text-sm text-hedge-green hover:text-hedge-green-dark font-medium mt-2 flex items-center gap-1"
                >
                  <span>+</span> Add another expense
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-pulse">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-hedge-green to-emerald-600 hover:to-emerald-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? 'Processing...' : 'Identify Hedge Opportunities'}
          </button>
        </form>
      </div>
    </div>
  )
}
