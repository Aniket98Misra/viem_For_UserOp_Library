import { encodeErrorResult } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { EntryPointRevertError, sendUserOperation } from '../src/actions/sendUserOperation';
import type { BundlerClient } from '../src/clients/createBundlerClient';
import type { UserOperationV06 } from '../src/types';

const ENTRY_POINT = '0x2222222222222222222222222222222222222222' as const;

const baseUserOp: UserOperationV06 = {
  sender: '0x1111111111111111111111111111111111111111',
  nonce: 5n,
  initCode: '0x',
  callData: '0x',
  callGasLimit: 100000n,
  verificationGasLimit: 100000n,
  preVerificationGas: 50000n,
  maxFeePerGas: 1000000000n,
  maxPriorityFeePerGas: 1000000000n,
  paymasterAndData: '0x',
  signature: '0x',
};

function mockBundlerClient(requestImpl: (args: unknown) => unknown): BundlerClient {
  return { request: vi.fn(requestImpl) } as unknown as BundlerClient;
}

describe('sendUserOperation', () => {
  it('hex-encodes every bigint field before sending — none reach the RPC as raw bigints', async () => {
    let capturedParams: unknown;
    const client = mockBundlerClient((args) => {
      capturedParams = args;
      return '0xhash';
    });

    await sendUserOperation(client, baseUserOp, ENTRY_POINT);

    const [sentUserOp] = (capturedParams as { params: [Record<string, unknown>, string] }).params;
    for (const [key, value] of Object.entries(sentUserOp)) {
      expect(typeof value, `field "${key}" must not be a raw bigint over JSON-RPC`).not.toBe('bigint');
    }
    expect(sentUserOp.nonce).toBe('0x5');
    expect(sentUserOp.callGasLimit).toBe('0x186a0');
  });

  it('omits undefined v0.7-only fields rather than sending literal "undefined"', async () => {
    let capturedParams: unknown;
    const client = mockBundlerClient((args) => {
      capturedParams = args;
      return '0xhash';
    });

    const v07Op = { ...baseUserOp, initCode: undefined, factory: undefined } as unknown as UserOperationV06;
    await sendUserOperation(client, v07Op, ENTRY_POINT);

    const [sentUserOp] = (capturedParams as { params: [Record<string, unknown>, string] }).params;
    expect('factory' in sentUserOp).toBe(false);
  });

  it('returns the userOpHash on success', async () => {
    const client = mockBundlerClient(() => '0xabc123');
    const hash = await sendUserOperation(client, baseUserOp, ENTRY_POINT);
    expect(hash).toBe('0xabc123');
  });

  it('unwraps a bundler-returned EntryPoint revert into a readable EntryPointRevertError', async () => {
    const revertData = encodeErrorResult({
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
      args: [0n, "AA21 didn't pay prefund"],
    });

    const client = mockBundlerClient(() => {
      throw { data: revertData };
    });

    await expect(sendUserOperation(client, baseUserOp, ENTRY_POINT)).rejects.toThrow(EntryPointRevertError);
    await expect(sendUserOperation(client, baseUserOp, ENTRY_POINT)).rejects.toThrow(/AA21/);
  });

  it('checks cause.data as a fallback for bundlers that nest revert data differently', async () => {
    const revertData = encodeErrorResult({
      abi: [{ type: 'error', name: 'FailedOp', inputs: [{ name: 'opIndex', type: 'uint256' }, { name: 'reason', type: 'string' }] }],
      errorName: 'FailedOp',
      args: [0n, 'AA25 invalid account nonce'],
    });
    const client = mockBundlerClient(() => {
      throw { cause: { data: revertData } };
    });

    await expect(sendUserOperation(client, baseUserOp, ENTRY_POINT)).rejects.toThrow(/AA25/);
  });

  it('rethrows the original error unchanged when there is no revert data to parse', async () => {
    const client = mockBundlerClient(() => {
      throw new Error('network timeout');
    });

    await expect(sendUserOperation(client, baseUserOp, ENTRY_POINT)).rejects.toThrow('network timeout');
  });
});
