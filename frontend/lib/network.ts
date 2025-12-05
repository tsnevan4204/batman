export async function switchToPolygonAmoy() {
  const chainId = '0x13882' // 80002
  const params = {
    chainId,
    chainName: 'Polygon Amoy',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://rpc-amoy.polygon.technology'],
    blockExplorerUrls: ['https://www.oklink.com/amoy']
  }
  await ensureNetwork(params)
}

export async function switchToBaseSepolia() {
  const chainId = '0x14a34' // 84532
  const params = {
    chainId,
    chainName: 'Base Sepolia',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia.basescan.org']
  }
  await ensureNetwork(params)
}

async function ensureNetwork(params: any) {
  // @ts-ignore
  const provider = window.ethereum
  if (!provider) throw new Error('Wallet provider not found')

  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: params.chainId }] })
    return
  } catch (switchError: any) {
    if (switchError?.code === 4902) {
      await provider.request({ method: 'wallet_addEthereumChain', params: [params] })
      return
    }
    throw switchError
  }
}
