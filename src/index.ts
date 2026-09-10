import type { Account, Chain, Client, PublicClient, Transport } from 'viem';
import { http } from 'viem';
import { prepareUserOperation, type PrepareUserOpParams } from './actions/prepareUserOperation';
import { sendUserOperation } from './actions/sendUserOperation';
import { createBundlerClient } from './clients/createBundlerClient';
import type { UserOperationV06, UserOperationV07 } from './types';

export type { PrepareUserOpParams } from './actions/prepareUserOperation';
export type { UserOperationV06, UserOperationV07, UserOperation, EntryPointVersion } from './types';
export { EntryPointRevertError } from './actions/sendUserOperation';
export { parseEntryPointError, formatEntryPointError } from './utils/errorParser';
export type { ParsedEntryPointError } from './utils/errorParser';

/**
 * viem client extension for ERC-4337. Use with `.extend()`:
 *
 * ```ts
 * const client = createPublicClient({ chain, transport: http() })
 *   .extend(eip4337Actions({ bundlerUrl: 'https://bundler.example/rpc', publicClient }));
 *
 * const userOp = await client.prepareUserOp({ sender, callData, entryPoint });
 * const hash = await client.sendUserOp({ userOp, entryPoint });
 * ```
 *
 * `bundlerUrl` builds its own HTTP transport for bundler-specific RPC
 * calls (`eth_sendUserOperation` etc.) — these are almost never the same
 * endpoint as the chain's own RPC, so the previous version silently
 * reusing `client.transport` for the bundler was routing every send
 * through the wrong endpoint entirely, not just an unused-parameter smell.
 */
export function eip4337Actions({ bundlerUrl, publicClient }: { bundlerUrl: string; publicClient: PublicClient }) {
  const bundlerClient = createBundlerClient({ transport: http(bundlerUrl) });

  return <
    TTransport extends Transport,
    TChain extends Chain | undefined = Chain | undefined,
    TAccount extends Account | undefined = Account | undefined,
  >(
    _client: Client<TTransport, TChain, TAccount>
  ) => ({
    async prepareUserOp(args: PrepareUserOpParams) {
      return prepareUserOperation(publicClient, args);
    },

    async sendUserOp(args: { userOp: UserOperationV06 | UserOperationV07; entryPoint: `0x${string}` }) {
      return sendUserOperation(bundlerClient, args.userOp, args.entryPoint);
    },
  });
}
