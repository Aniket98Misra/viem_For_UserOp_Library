import type { Address, Hex } from 'viem';

/** ERC-4337 v0.6 UserOperation shape. */
export type UserOperationV06 = {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
};

/**
 * ERC-4337 v0.7 UserOperation shape, as accepted by `eth_sendUserOperation`
 * over the bundler RPC (the "unpacked" JSON view — distinct from the
 * `PackedUserOperation` struct EntryPoint v0.7 uses on-chain, where
 * accountGasLimits/gasFees are packed into bytes32 pairs). Bundlers handle
 * that packing internally; callers of this library work with the unpacked
 * fields below, matching the standard bundler JSON-RPC interface.
 */
export type UserOperationV07 = {
  sender: Address;
  nonce: bigint;
  factory?: Address;
  factoryData?: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymaster?: Address;
  paymasterVerificationGasLimit?: bigint;
  paymasterPostOpGasLimit?: bigint;
  paymasterData?: Hex;
  signature: Hex;
};

export type UserOperation = UserOperationV06 | UserOperationV07;

export type EntryPointVersion = 'v0.6' | 'v0.7';

/** Discriminates a UserOperation by the presence of v0.7-only fields. */
export function isUserOperationV07(op: UserOperation): op is UserOperationV07 {
  return !('initCode' in op);
}
