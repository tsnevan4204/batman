'use client';

import { ReactNode } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { baseSepolia } from 'wagmi/chains';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: 'Hedger',
      preference: 'smartWalletOnly', // Force Smart Wallet for paymaster support
    }),
  ],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'),
  },
});

const queryClient = new QueryClient();

export function Providers(props: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={baseSepolia}
          config={{
            appearance: {
              mode: 'light',
            },
            paymaster: process.env.NEXT_PUBLIC_PAYMASTER_RPC_URL,
          }}
        >
          {props.children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
