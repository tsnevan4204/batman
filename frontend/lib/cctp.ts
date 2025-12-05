import { ethers } from 'ethers'
import axios from 'axios'

// Circle CCTP testnet defaults (can be overridden by env)
const DEFAULT_BASE_TOKEN_MESSENGER = '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5'
const DEFAULT_POLY_TOKEN_MESSENGER = '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5'
const DEFAULT_BASE_MESSAGE_TRANSMITTER = '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD'
const DEFAULT_POLY_MESSAGE_TRANSMITTER = '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD'
const DEFAULT_BASE_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const DEFAULT_POLY_USDC = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'
const DEFAULT_ATTESTATION_API = 'https://iris-api-sandbox.circle.com'

// CCTP domain IDs (testnet)
// Polygon Amoy domain ID (Circle): 7
// Base Sepolia domain ID (Base): 6
const DEFAULT_DESTINATION_DOMAIN = 7

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)'
]

const TOKEN_MESSENGER_ABI = [
  'event MessageSent(bytes message)',
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64 nonce)'
]

const MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)'
]

export type BridgeStatus = 'idle' | 'burning' | 'attestation_pending' | 'attested' | 'claiming' | 'claimed' | 'error'

export interface BurnResult {
  txHash: string
  messageHash: string // keccak256 hash of MessageSent.message; needed for attestation
  message?: string    // raw message bytes (hex) for claim step
}

export interface AttestationResult {
  status: 'pending' | 'complete' | 'not_found'
  attestation?: string
}

export async function burnUSDC({
  signer,
  amount,
  recipient,
  destinationDomain = DEFAULT_DESTINATION_DOMAIN,
}: {
  signer: ethers.Signer
  amount: bigint // 6-decimal USDC
  recipient: string // address on destination chain
  destinationDomain?: number
}): Promise<BurnResult> {
  const tokenMessenger = new ethers.Contract(
    process.env.NEXT_PUBLIC_CCTP_BASE_TOKEN_MESSENGER || DEFAULT_BASE_TOKEN_MESSENGER,
    TOKEN_MESSENGER_ABI,
    signer
  )

  const usdc = new ethers.Contract(
    process.env.NEXT_PUBLIC_USDC_BASE_SEPOLIA || DEFAULT_BASE_USDC,
    ERC20_ABI,
    signer
  )

  const recipientBytes32 = ethers.zeroPadValue(recipient as `0x${string}`, 32)

  // Ensure allowance
  const owner = await signer.getAddress()
  const currentAllowance: bigint = await usdc.allowance(owner, tokenMessenger.target)
  if (currentAllowance < amount) {
    const approveTx = await usdc.approve(tokenMessenger.target, amount)
    await approveTx.wait()
  }

  const tx = await tokenMessenger.depositForBurn(
    amount,
    destinationDomain,
    recipientBytes32,
    process.env.NEXT_PUBLIC_USDC_BASE_SEPOLIA || DEFAULT_BASE_USDC
  )
  const receipt = await tx.wait()

  // Extract MessageSent.message
  let messageHash = ethers.ZeroHash
  let message: string | undefined
  if (receipt?.logs) {
    // keccak256("MessageSent(bytes)")
    const messageSentTopic = '0x6a7f62b8c9e5773e9bd6f66a701d89f5cb9184160a95cace0bbd10db13c9f899'
    const log = receipt.logs.find((l: any) => l.topics && l.topics[0] === messageSentTopic)
    if (log?.data) {
      message = log.data
      messageHash = ethers.keccak256(log.data)
    }
  }

  return {
    txHash: tx.hash,
    messageHash,
    message,
  }
}

export async function getAttestation(messageHash: string): Promise<AttestationResult> {
  const apiBase = process.env.NEXT_PUBLIC_CIRCLE_ATTESTATION_API || DEFAULT_ATTESTATION_API
  const url = `${apiBase}/attestations/${messageHash}`
  const res = await axios.get(url)
  const status = res.data?.status as string
  if (status === 'complete') {
    return { status: 'complete', attestation: res.data?.attestation } as AttestationResult
  }
  if (status === 'pending') {
    return { status: 'pending' }
  }
  return { status: 'not_found' }
}

function decodeBase64ToBytes(data: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(data)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }
  // Node fallback
  return Uint8Array.from(Buffer.from(data, 'base64'))
}

export async function claimUSDC({
  signer,
  message,
  attestation,
}: {
  signer: ethers.Signer
  message: string // bytes hex from MessageSent
  attestation: string // base64 string from Circle
}): Promise<string> {
  const transmitter = new ethers.Contract(
    process.env.NEXT_PUBLIC_CCTP_POLYGON_MESSAGE_TRANSMITTER || DEFAULT_POLY_MESSAGE_TRANSMITTER,
    MESSAGE_TRANSMITTER_ABI,
    signer
  )

  const attestationBytes = decodeBase64ToBytes(attestation)
  const messageBytes = ethers.getBytes(message)

  const tx = await transmitter.receiveMessage(messageBytes, attestationBytes)
  const receipt = await tx.wait()
  return receipt.hash
}

export async function getBridgeStatus(messageHash: string): Promise<BridgeStatus> {
  if (!messageHash || messageHash === ethers.ZeroHash) return 'idle'
  const att = await getAttestation(messageHash)
  if (att.status === 'pending') return 'attestation_pending'
  if (att.status === 'complete') return 'attested'
  return 'error'
}
