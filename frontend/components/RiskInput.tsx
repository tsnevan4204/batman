'use client'

import { useState } from 'react'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface RiskInputProps {
  onMatch: (description: string, markets: any[]) => void
}

export default function RiskInput({ onMatch }: RiskInputProps) {
  const [riskDescription, setRiskDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!riskDescription.trim()) {
      setError('Please enter a risk description')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.post(`${API_BASE_URL}/api/match-risk`, {
        risk_description: riskDescription,
      })

      if (response.data.matches && response.data.matches.length > 0) {
        onMatch(riskDescription, response.data.matches)
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
    <div className="max-w-3xl mx-auto">
      <div className="bg-gray-800 rounded-lg p-8 shadow-lg">
        <h2 className="text-2xl font-semibold text-white mb-4">
          Describe Your Business Risk
        </h2>
        <p className="text-gray-400 mb-6">
          Enter a natural language description of the business risk you want to hedge.
          For example: "Our company relies heavily on shipping from Asia. If shipping costs
          increase by more than 20% in the next quarter, it will significantly impact our margins."
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={riskDescription}
            onChange={(e) => setRiskDescription(e.target.value)}
            placeholder="E.g., Risk of supply chain disruption affecting our manufacturing operations..."
            className="w-full h-40 p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
            disabled={isLoading}
          />

          {error && (
            <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !riskDescription.trim()}
            className="mt-6 w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isLoading ? 'Finding Hedge Options...' : 'Find Hedge Options'}
          </button>
        </form>
      </div>
    </div>
  )
}

