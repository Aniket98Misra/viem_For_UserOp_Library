/**
 * Minimal EntryPoint ABI — only what this library actually calls or decodes
 * against. Sourced from the canonical eth-infinitism/account-abstraction
 * reference implementation (the de facto spec reference every bundler and
 * wallet implements against), not reconstructed from memory of function
 * names alone. Errors are declared as real Solidity custom errors so viem's
 * own `decodeErrorResult` computes their selectors from the ABI — this is
 * the fix for the previous version's mistake of hand-typing placeholder
 * hex selectors that didn't correspond to anything real.
 */
export const entryPointAbi = [
  {
    type: 'function',
    name: 'getNonce',
    stateMutability: 'view',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'key', type: 'uint192' },
    ],
    outputs: [{ name: 'nonce', type: 'uint256' }],
  },
  // Thrown by handleOps when a specific UserOperation in the batch fails
  // simulation or validation. `reason` carries the "AA.." code string.
  {
    type: 'error',
    name: 'FailedOp',
    inputs: [
      { name: 'opIndex', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
  },
  // v0.7 adds the inner revert bytes alongside the reason string.
  {
    type: 'error',
    name: 'FailedOpWithRevert',
    inputs: [
      { name: 'opIndex', type: 'uint256' },
      { name: 'reason', type: 'string' },
      { name: 'inner', type: 'bytes' },
    ],
  },
  {
    type: 'error',
    name: 'SignatureValidationFailed',
    inputs: [{ name: 'aggregator', type: 'address' }],
  },
] as const;
