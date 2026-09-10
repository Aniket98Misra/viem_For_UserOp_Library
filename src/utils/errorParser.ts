import { decodeErrorResult, type Hex } from 'viem';
import { entryPointAbi } from '../abi/entryPoint';

/**
 * The "AA.." code -> human explanation table below follows the convention
 * used throughout the eth-infinitism EntryPoint reference contract's own
 * inline comments (the canonical source every ERC-4337 implementation
 * tracks). It is NOT a selector table — EntryPoint does not have one error
 * per AA code. Every validation/execution failure reverts through exactly
 * one of a small number of custom errors (FailedOp, FailedOpWithRevert),
 * and the AA code is a prefix embedded inside that error's `reason` string
 * argument (e.g. reason = "AA21 didn't pay prefund"). This table exists to
 * translate that already-decoded string into a slightly more explanatory
 * message — it plays no role in selector matching, which viem's
 * `decodeErrorResult` handles correctly against the ABI itself.
 */
const AA_CODE_EXPLANATIONS: Record<string, string> = {
  AA10: 'Sender account already constructed — initCode/factory should be empty for an already-deployed account.',
  AA13: "initCode failed or ran out of gas during the account's deployment.",
  AA14: "initCode returned an address that doesn't match the expected sender.",
  AA15: 'initCode did not deploy a contract at the sender address.',
  AA20: 'Account not deployed, and no initCode/factory was provided to deploy it.',
  AA21: "Sender didn't pay the required prefund — it (or its paymaster) needs more ETH deposited.",
  AA22: 'UserOperation expired, or its validity window has not started yet.',
  AA23: 'Account validation reverted (or ran out of gas) inside validateUserOp.',
  AA24: 'Signature error during account validation.',
  AA25: 'Invalid account nonce.',
  AA30: 'Paymaster not deployed at the given address.',
  AA31: "Paymaster's deposit is too low to cover this operation.",
  AA32: "Paymaster's validity window has expired or not started yet.",
  AA33: 'Paymaster validation reverted (or ran out of gas) inside validatePaymasterUserOp.',
  AA34: 'Signature error during paymaster validation.',
  AA40: 'Operation used more gas than its verificationGasLimit allowed.',
  AA41: 'verificationGasLimit was too low to complete validation.',
  AA50: "Paymaster's postOp call reverted.",
  AA51: 'Prefund was below the actual gas cost after execution.',
};

export type ParsedEntryPointError = {
  /** The decoded custom error's name, e.g. "FailedOp". */
  errorName: string;
  /** Which UserOperation in the batch failed, if applicable. */
  opIndex?: bigint;
  /** The raw reason string as returned by EntryPoint, e.g. "AA21 didn't pay prefund". */
  reason?: string;
  /** Human-readable explanation looked up from the AA code, if recognized. */
  explanation?: string;
  /** True if the revert data didn't match any known EntryPoint error shape. */
  unrecognized: boolean;
  /** The original revert data, always preserved for debugging regardless of decode success. */
  raw: Hex;
};

/**
 * Decodes a revert against the real EntryPoint ABI (not a hand-typed
 * selector table) and, where the decoded reason string carries a
 * recognizable "AA.." prefix, attaches a human-readable explanation.
 *
 * Never throws — a revert that doesn't match any known EntryPoint error
 * (a plain require() string from a paymaster's own logic, for instance)
 * comes back with `unrecognized: true` and the raw bytes preserved, rather
 * than masking it as some other error or silently swallowing it.
 */
export function parseEntryPointError(revertData: Hex): ParsedEntryPointError {
  try {
    const decoded = decodeErrorResult({ abi: entryPointAbi, data: revertData });

    if (decoded.errorName === 'FailedOp' || decoded.errorName === 'FailedOpWithRevert') {
      const [opIndex, reason] = decoded.args as readonly [bigint, string, ...unknown[]];
      const code = reason.slice(0, 4);
      return {
        errorName: decoded.errorName,
        opIndex,
        reason,
        explanation: AA_CODE_EXPLANATIONS[code],
        unrecognized: false,
        raw: revertData,
      };
    }

    // viem recognizes Solidity's two language-level built-in reverts —
    // Error(string) and Panic(uint256) — against ANY abi, since they're not
    // user-defined errors. TypeScript's inferred type for `errorName` only
    // includes names present in `entryPointAbi`, but viem can still return
    // these two at runtime regardless — hence the explicit widen below.
    const errorName = decoded.errorName as string;
    if (errorName === 'Error') {
      const [message] = decoded.args as readonly [string];
      return { errorName: 'Error', reason: message, unrecognized: false, raw: revertData };
    }
    if (errorName === 'Panic') {
      const [code] = decoded.args as unknown as readonly [bigint];
      return { errorName: 'Panic', reason: `panic code 0x${code.toString(16)}`, unrecognized: false, raw: revertData };
    }

    return {
      errorName: decoded.errorName,
      unrecognized: false,
      raw: revertData,
    };
  } catch {
    // Not FailedOp/FailedOpWithRevert/SignatureValidationFailed, and not a
    // standard Error(string)/Panic(uint256) either — most likely a custom
    // error from deeper in the call (a paymaster's own custom error, for
    // instance) that this library doesn't have the ABI for. Surface that
    // honestly rather than guessing at a match.
    return { errorName: 'Unknown', unrecognized: true, raw: revertData };
  }
}

/** Convenience formatter for logging/UI — one line, always safe to print. */
export function formatEntryPointError(parsed: ParsedEntryPointError): string {
  if (parsed.unrecognized) {
    return `Unrecognized EntryPoint revert (raw): ${parsed.raw}`;
  }
  if (parsed.reason) {
    const suffix = parsed.explanation ? ` — ${parsed.explanation}` : '';
    return `${parsed.errorName}${parsed.opIndex !== undefined ? ` (op #${parsed.opIndex})` : ''}: ${parsed.reason}${suffix}`;
  }
  return `${parsed.errorName} (no reason string provided)`;
}
