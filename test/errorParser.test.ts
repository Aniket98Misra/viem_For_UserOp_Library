import { encodeErrorResult } from 'viem';
import { describe, expect, it } from 'vitest';
import { formatEntryPointError, parseEntryPointError } from '../src/utils/errorParser';

/** Encodes a real ABI-correct FailedOp revert, the same way EntryPoint itself would. */
function encodeFailedOp(opIndex: bigint, reason: string) {
  return encodeErrorResult({
    abi: [
      {
        type: 'error',
        name: 'FailedOp',
        inputs: [
          { name: 'opIndex', type: 'uint256' },
          { name: 'reason', type: 'string' },
        ],
      },
    ],
    errorName: 'FailedOp',
    args: [opIndex, reason],
  });
}

function encodeFailedOpWithRevert(opIndex: bigint, reason: string, inner: `0x${string}`) {
  return encodeErrorResult({
    abi: [
      {
        type: 'error',
        name: 'FailedOpWithRevert',
        inputs: [
          { name: 'opIndex', type: 'uint256' },
          { name: 'reason', type: 'string' },
          { name: 'inner', type: 'bytes' },
        ],
      },
    ],
    errorName: 'FailedOpWithRevert',
    args: [opIndex, reason, inner],
  });
}

describe('parseEntryPointError', () => {
  it('decodes a real AA21 FailedOp revert, not a hand-typed fake selector', () => {
    const revertData = encodeFailedOp(0n, "AA21 didn't pay prefund");
    const parsed = parseEntryPointError(revertData);

    expect(parsed.unrecognized).toBe(false);
    expect(parsed.errorName).toBe('FailedOp');
    expect(parsed.opIndex).toBe(0n);
    expect(parsed.reason).toBe("AA21 didn't pay prefund");
    expect(parsed.explanation).toMatch(/prefund/i);
  });

  it('decodes FailedOpWithRevert (v0.7) including the inner revert bytes case', () => {
    const revertData = encodeFailedOpWithRevert(2n, 'AA23 reverted (or OOG)', '0xdeadbeef');
    const parsed = parseEntryPointError(revertData);

    expect(parsed.errorName).toBe('FailedOpWithRevert');
    expect(parsed.opIndex).toBe(2n);
    expect(parsed.reason).toBe('AA23 reverted (or OOG)');
    expect(parsed.explanation).toMatch(/validateUserOp/i);
  });

  it('looks up the correct explanation for each documented AA code', () => {
    const cases: Array<[string, RegExp]> = [
      ["AA10 sender already constructed", /already constructed/i],
      ["AA25 invalid account nonce", /nonce/i],
      ["AA31 paymaster deposit too low", /deposit/i],
    ];
    for (const [reason, expected] of cases) {
      const parsed = parseEntryPointError(encodeFailedOp(0n, reason));
      expect(parsed.explanation).toMatch(expected);
    }
  });

  it('does NOT match placeholder values the previous version hardcoded (0xdeadbeef, 0x1337c0d3)', () => {
    // The old implementation's selector table used made-up hex values that
    // don't correspond to any real Solidity error. Confirms those are
    // correctly treated as unrecognized now, not as fake "successful" matches.
    const parsed = parseEntryPointError('0xdeadbeef');
    expect(parsed.unrecognized).toBe(true);
  });

  it('decodes a standard Error(string) revert (e.g. from a paymaster) and surfaces its message', () => {
    // EntryPoint-adjacent contracts (a paymaster's own require()) can revert
    // with a plain Error(string) that ISN'T a FailedOp. viem recognizes this
    // universally since it's a Solidity language built-in, not a
    // user-defined error — worth surfacing the real message rather than
    // discarding it or misreporting it as an EntryPoint-specific error.
    const plainError = encodeErrorResult({
      abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }],
      errorName: 'Error',
      args: ['insufficient balance'],
    });
    const parsed = parseEntryPointError(plainError);
    expect(parsed.unrecognized).toBe(false);
    expect(parsed.errorName).toBe('Error');
    expect(parsed.reason).toBe('insufficient balance');
  });

  it('truly unrecognized revert data (no matching selector at all) is reported as unrecognized', () => {
    const parsed = parseEntryPointError('0xffffffff');
    expect(parsed.unrecognized).toBe(true);
  });

  it('never throws on garbage input, always returns raw bytes for debugging', () => {
    const parsed = parseEntryPointError('0x1234');
    expect(parsed.unrecognized).toBe(true);
    expect(parsed.raw).toBe('0x1234');
  });

  it('formatEntryPointError produces a readable one-liner including the AA explanation', () => {
    const parsed = parseEntryPointError(encodeFailedOp(1n, "AA21 didn't pay prefund"));
    const formatted = formatEntryPointError(parsed);
    expect(formatted).toContain('AA21');
    expect(formatted).toContain('op #1');
    expect(formatted.toLowerCase()).toContain('prefund');
  });

  it('formats an unrecognized revert without throwing or losing the raw data', () => {
    const formatted = formatEntryPointError(parseEntryPointError('0xdeadbeef'));
    expect(formatted).toContain('0xdeadbeef');
  });
});
