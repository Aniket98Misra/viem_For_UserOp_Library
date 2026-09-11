import type { Address, Hex, PublicClient } from 'viem';
import { entryPointAbi } from '../abi/entryPoint';
import type { EntryPointVersion, UserOperationV06, UserOperationV07 } from '../types';

export type PrepareUserOpParams = {
  sender: Address;
  callData: Hex;
  entryPoint: Address;
  version?: EntryPointVersion; // defaults to 'v0.6'
  /** v0.6 only. Leave undefined/'0x' for an already-deployed account. */
  initCode?: Hex;
  /** v0.7 only — the factory/factoryData split that replaced initCode. */
  factory?: Address;
  factoryData?: Hex;
  paymasterAndData?: Hex; // v0.6
  paymaster?: Address; // v0.7
  paymasterData?: Hex; // v0.7
  /** Nonce key per EIP-4337's 2D nonce scheme. Defaults to 0 (sequential). */
  nonceKey?: bigint;
};

/**
 * Builds an unsigned, unestimated UserOperation for the given EntryPoint
 * version. Gas fields are intentionally left at 0n — this function's job is
 * correct structure and a real on-chain nonce, not gas estimation, which
 * depends on the bundler (`eth_estimateUserOperationGas`) and is out of
 * scope for a single pure function. `signature` is `'0x'`, ready for the
 * caller's own signing step before `sendUserOperation`.
 *
 * The nonce is fetched for real via `EntryPoint.getNonce(sender, key)` —
 * the previous version of this function hardcoded `0n` with a comment
 * promising this would be wired up later. It wasn't, and every UserOp past
 * an account's very first would have been broken. Fixed here.
 */
export async function prepareUserOperation(
  publicClient: PublicClient,
  params: PrepareUserOpParams
): Promise<UserOperationV06 | UserOperationV07> {
  const version = params.version ?? 'v0.6';
  const nonceKey = params.nonceKey ?? 0n;

  const nonce = await publicClient.readContract({
    address: params.entryPoint,
    abi: entryPointAbi,
    functionName: 'getNonce',
    args: [params.sender, nonceKey],
  });

  const base = {
    sender: params.sender,
    nonce,
    callData: params.callData,
    callGasLimit: 0n,
    verificationGasLimit: 0n,
    preVerificationGas: 0n,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
    signature: '0x' as Hex,
  };

  if (version === 'v0.6') {
    const userOp: UserOperationV06 = {
      ...base,
      initCode: params.initCode ?? '0x',
      paymasterAndData: params.paymasterAndData ?? '0x',
    };
    return userOp;
  }

  const userOp: UserOperationV07 = {
    ...base,
    factory: params.factory,
    factoryData: params.factoryData,
    paymaster: params.paymaster,
    paymasterVerificationGasLimit: params.paymaster ? 0n : undefined,
    paymasterPostOpGasLimit: params.paymaster ? 0n : undefined,
    paymasterData: params.paymasterData,
  };
  return userOp;
}
