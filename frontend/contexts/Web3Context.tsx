'use client'

import { ReactNode, createContext, useCallback, useContext } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ethers } from 'ethers'
import { parseUnits } from 'viem'
import { HEDGE_REGISTRY_ADDRESS } from '@/constants/addresses'

type RecordHedgeParams = {
  riskDescription: string
  marketId: string
  amount: string
  tradeTxHash: string
  bridgeTxHash: string
  bridgeMessageHash: string
}

type Web3ContextValue = {
  getProvider: () => ethers.BrowserProvider
  getSigner: () => Promise<ethers.Signer>
  recordHedgeReceipt: (params: RecordHedgeParams) => Promise<{ txHash: string }>
}

const registryAbi = [
  'function recordHedge(bytes32 riskHash, string calldata marketId, uint256 amount, string calldata tradeTxHash, string calldata bridgeTxHash, bytes32 bridgeMessageHash) external returns (uint256 receiptTokenId)',
]

const Web3Context = createContext<Web3ContextValue | null>(null)

const resolveProvider = (walletClient?: any) => {
  if (walletClient?.transport) {
    return new ethers.BrowserProvider(walletClient.transport, walletClient.chain?.id)
  }

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

export function Web3Provider({ children }: { children: ReactNode }) {
  useAccount() // keep wagmi wallet state active for downstream hooks
  const { data: walletClient } = useWalletClient()

  const getProvider = useCallback(() => {
    return resolveProvider(walletClient)
  }, [walletClient])

  const getSigner = useCallback(async () => {
    const provider = getProvider()
    return provider.getSigner()
  }, [getProvider])

  const recordHedgeReceipt = useCallback(
    async (params: RecordHedgeParams) => {
      if (!HEDGE_REGISTRY_ADDRESS) {
        throw new Error('Missing NEXT_PUBLIC_HEDGE_REGISTRY_ADDRESS')
      }

      const signer = await getSigner()
      const provider = signer.provider
      if (!provider) {
        throw new Error('No provider available from signer')
      }

      // Ensure we are on Base Sepolia (chain id 84532)
      const network = await provider.getNetwork()
      if (network?.chainId !== 84532n) {
        throw new Error(`Wrong network: expected Base Sepolia (84532), got chainId ${network?.chainId}`)
      }

      // Ensure the registry address actually has code
      const code = await provider.getCode(HEDGE_REGISTRY_ADDRESS)
      if (!code || code === '0x') {
        throw new Error('HedgeRegistry address has no contract code on this network')
      }

      const contract = new ethers.Contract(HEDGE_REGISTRY_ADDRESS, registryAbi, signer)
      const amountWei = parseUnits(params.amount, 6)
      const riskHash = ethers.keccak256(ethers.toUtf8Bytes(params.riskDescription || ''))

      const tx = await contract.recordHedge(
        riskHash,
        params.marketId,
        amountWei,
        params.tradeTxHash || 'trade-failed',
        params.bridgeTxHash || '',
        params.bridgeMessageHash || ethers.ZeroHash
      )

      await tx.wait()
      return { txHash: tx.hash }
    },
    [getSigner]
  )

  return (
    <Web3Context.Provider value={{ getProvider, getSigner, recordHedgeReceipt }}>
      {children}
    </Web3Context.Provider>
  )
}

export const useWeb3 = () => {
  const ctx = useContext(Web3Context)
  if (!ctx) {
    throw new Error('useWeb3 must be used within a Web3Provider')
  }
  return ctx
}

