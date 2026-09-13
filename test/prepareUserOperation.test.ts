import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { prepareUserOperation } from '../src/actions/prepareUserOperation';

function mockPublicClient(nonceToReturn: bigint): PublicClient {
  return {
    readContract: vi.fn().mockResolvedValue(nonceToReturn),
  } as unknown as PublicClient;
}

const SENDER = '0x1111111111111111111111111111111111111111' as const;
const ENTRY_POINT = '0x2222222222222222222222222222222222222222' as const;

describe('prepareUserOperation', () => {
  it('fetches the nonce from EntryPoint.getNonce rather than hardcoding it', async () => {
    const client = mockPublicClient(7n);
    const userOp = await prepareUserOperation(client, {
      sender: SENDER,
      callData: '0x',
      entryPoint: ENTRY_POINT,
    });

    expect(userOp.nonce).toBe(7n);
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: ENTRY_POINT,
        functionName: 'getNonce',
        args: [SENDER, 0n],
      })
    );
  });

  it('uses a nonzero real nonce for an account that has already transacted', async () => {
    // This is the exact case the previous hardcoded `mockNonce = 0n` broke:
    // any account past its first UserOperation would silently get a wrong,
    // already-used nonce and fail on-chain.
    const client = mockPublicClient(42n);
    const userOp = await prepareUserOperation(client, {
      sender: SENDER,
      callData: '0x',
      entryPoint: ENTRY_POINT,
    });
    expect(userOp.nonce).toBe(42n);
  });

  it('defaults to v0.6 shape with initCode and paymasterAndData fields', async () => {
    const client = mockPublicClient(0n);
    const userOp = await prepareUserOperation(client, {
      sender: SENDER,
      callData: '0x',
      entryPoint: ENTRY_POINT,
    });

    expect(userOp).toHaveProperty('initCode');
    expect(userOp).toHaveProperty('paymasterAndData');
    expect(userOp).not.toHaveProperty('factory');
  });

  it('produces v0.7 shape with factory/factoryData instead of initCode', async () => {
    const client = mockPublicClient(0n);
    const userOp = await prepareUserOperation(client, {
      sender: SENDER,
      callData: '0x',
      entryPoint: ENTRY_POINT,
      version: 'v0.7',
      factory: '0x3333333333333333333333333333333333333333',
      factoryData: '0xabcdef',
    });

    expect(userOp).not.toHaveProperty('initCode');
    expect((userOp as { factory?: string }).factory).toBe('0x3333333333333333333333333333333333333333');
    expect((userOp as { factoryData?: string }).factoryData).toBe('0xabcdef');
  });

  it('respects a custom nonce key for the 2D nonce scheme', async () => {
    const client = mockPublicClient(5n);
    await prepareUserOperation(client, {
      sender: SENDER,
      callData: '0x',
      entryPoint: ENTRY_POINT,
      nonceKey: 99n,
    });

    expect(client.readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [SENDER, 99n] }));
  });
});
