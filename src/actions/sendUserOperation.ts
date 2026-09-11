import type { Address, Hex } from 'viem';
import { toHex } from 'viem';
import type { BundlerClient } from '../clients/createBundlerClient';
import type { UserOperationV06, UserOperationV07 } from '../types';
import { formatEntryPointError, parseEntryPointError } from '../utils/errorParser';

/** Recursively hex-encodes bigint fields so the UserOp is JSON-RPC safe. */
function encodeUserOpForRpc(userOp: UserOperationV06 | UserOperationV07) {
  return Object.fromEntries(
    Object.entries(userOp)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, typeof value === 'bigint' ? toHex(value) : value])
  ) as unknown as UserOperationV06 | UserOperationV07;
}

export class EntryPointRevertError extends Error {
  constructor(
    message: string,
    public readonly parsed: ReturnType<typeof parseEntryPointError>
  ) {
    super(message);
    this.name = 'EntryPointRevertError';
  }
}

/**
 * Sends a UserOperation via `eth_sendUserOperation`. Bigint fields are
 * hex-encoded first since JSON-RPC has no native bigint representation.
 *
 * If the bundler returns revert data (the shape most bundlers use for a
 * simulation failure), it's decoded against the real EntryPoint ABI and
 * re-thrown as an `EntryPointRevertError` carrying the parsed reason —
 * callers get a message like `FailedOp (op #0): AA21 didn't pay prefund —
 * Sender didn't pay the required prefund...` instead of a bare RPC error
 * object with an opaque `data` field they'd have to decode by hand.
 */
export async function sendUserOperation(
  bundlerClient: BundlerClient,
  userOp: UserOperationV06 | UserOperationV07,
  entryPoint: Address
): Promise<Hex> {
  const formattedUserOp = encodeUserOpForRpc(userOp);

  try {
    return await bundlerClient.request({
      method: 'eth_sendUserOperation',
      params: [formattedUserOp, entryPoint],
    });
  } catch (error) {
    const revertData = extractRevertData(error);
    if (revertData) {
      const parsed = parseEntryPointError(revertData);
      throw new EntryPointRevertError(formatEntryPointError(parsed), parsed);
    }
    throw error;
  }
}

/**
 * Bundler RPC error shapes vary — some nest revert data under `data`,
 * others under `cause.data` (viem's own transport error wrapping). This
 * checks both rather than assuming one, so real errors aren't silently
 * passed through as unparsed on a bundler that shapes them differently.
 */
function extractRevertData(error: unknown): Hex | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const err = error as { data?: unknown; cause?: { data?: unknown } };
  const candidate = err.data ?? err.cause?.data;
  return typeof candidate === 'string' && candidate.startsWith('0x') ? (candidate as Hex) : undefined;
}
