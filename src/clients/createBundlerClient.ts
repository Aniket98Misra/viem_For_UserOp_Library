import { createClient, rpcSchema, type Address, type Chain, type Client, type Hex, type Transport } from 'viem';
import type { UserOperationV06, UserOperationV07 } from '../types';

/**
 * The standard ERC-4337 bundler JSON-RPC methods this library calls,
 * wired into `createClient` via viem's own `rpcSchema<T>()` helper below —
 * this is what actually gives `bundlerClient.request(...)` inferred
 * params/return types end-to-end. The previous version declared an
 * equivalent interface and never passed it to `createClient` at all, so it
 * had zero effect on the resulting client's types.
 */
export type BundlerRpcSchema = [
  {
    Method: 'eth_sendUserOperation';
    Parameters: [userOp: UserOperationV06 | UserOperationV07, entryPoint: Address];
    ReturnType: Hex;
  },
  {
    Method: 'eth_estimateUserOperationGas';
    Parameters: [userOp: UserOperationV06 | UserOperationV07, entryPoint: Address];
    ReturnType: {
      preVerificationGas: Hex;
      verificationGasLimit: Hex;
      callGasLimit: Hex;
      paymasterVerificationGasLimit?: Hex;
    };
  },
  {
    Method: 'eth_getUserOperationReceipt';
    Parameters: [userOpHash: Hex];
    ReturnType: {
      userOpHash: Hex;
      success: boolean;
      receipt: { transactionHash: Hex; blockNumber: Hex };
    } | null;
  },
];

export type BundlerClient<TTransport extends Transport = Transport> = Client<
  TTransport,
  Chain | undefined,
  undefined,
  BundlerRpcSchema
>;

export function createBundlerClient<TTransport extends Transport>({
  transport,
  chain,
}: {
  transport: TTransport;
  chain?: Chain;
}): BundlerClient<TTransport> {
  return createClient({
    chain,
    transport,
    type: 'bundlerClient',
    rpcSchema: rpcSchema<BundlerRpcSchema>(),
  });
}
