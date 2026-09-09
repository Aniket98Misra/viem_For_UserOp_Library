import { Account, Chain, Client, PublicClient, Transport } from 'viem';
import { prepareUserOperation, PrepareUserOpParams } from './actions/prepareUserOperation';
import { sendUserOperation } from './actions/sendUserOperation';
import { createBundlerClient } from './clients/createBundlerClient';

export function eip4337Actions(bundlerUrl: string, publicClient: PublicClient) {
  return <
    TTransport extends Transport,
    TChain extends Chain | undefined = Chain | undefined,
    TAccount extends Account | undefined = Account | undefined
  >(
    client: Client<TTransport, TChain, TAccount>
  ) => {
    // Instantiate our custom transport layer
    const bundlerClient = createBundlerClient({
      transport: client.transport,
      chain: client.chain,
    });

    return {
      async prepareUserOp(args: PrepareUserOpParams) {
        return prepareUserOperation(publicClient, args);
      },
      
      async sendUserOp(args: { userOp: any; entryPoint: `0x${string}` }) {
        return sendUserOperation(bundlerClient, args.userOp, args.entryPoint);
      },
    };
  };
}