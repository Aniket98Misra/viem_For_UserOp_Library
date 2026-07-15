# Viem ERC-4337 Extension 🚀

A lightweight, provider-agnostic Viem extension for Account Abstraction (EIP-4337) primitives. 

Currently, constructing UserOperations requires heavy abstraction frameworks or manual calldata encoding. This extension hooks directly into Viem's native `.extend()` pattern, giving you low-level control over `UserOperation` structs, EntryPoint validations, and Bundler RPC communication.

## Features
- 🔌 **Native Viem Extension:** Uses `walletClient.extend()` for frictionless integration.
- 🧱 **EntryPoint v0.6 & v0.7 Support:** Explicit type handling for the `initCode` to `factory/factoryData` unpacking.
- 🕵️ **Revert Parsing:** Decodes obscure EntryPoint hex errors (e.g., `AA21 didn't pay preverification gas`) into readable strings.
- 🪶 **Provider Agnostic:** Bring your own bundler and paymaster.

## Quickstart

```typescript
import { createWalletClient, http, createPublicClient } from 'viem';
import { mainnet } from 'viem/chains';
import { eip4337Actions } from 'viem-erc4337-extension';

const publicClient = createPublicClient({ chain: mainnet, transport: http() });

const client = createWalletClient({
  chain: mainnet,
  transport: http('YOUR_RPC_URL')
}).extend(eip4337Actions('YOUR_BUNDLER_URL', publicClient));

// Construct and send!
const userOp = await client.prepareUserOp({
  sender: '0x...',
  callData: '0x...',
  entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  version: 'v0.6' 
});

const hash = await client.sendUserOp({ userOp, entryPoint });
