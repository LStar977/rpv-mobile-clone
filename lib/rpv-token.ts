// RPV Token contract on Base Sepolia
export const RPV_TOKEN_ADDRESS = '0x4a57Cd1C4235cb7Af37625bA59bA00beB2265312';

// Base Sepolia RPC endpoint
const RPC_URL = 'https://sepolia.base.org';

// ERC-20 balanceOf function selector: keccak256("balanceOf(address)")[:4]
const BALANCE_OF_SELECTOR = '0x70a08231';

/**
 * Get RPV token balance for a wallet address using direct RPC call
 * @param walletAddress - The wallet address to check
 * @returns The token balance as a number (human-readable, not wei)
 */
export async function getRPVBalance(walletAddress: string): Promise<number> {
  console.log('[RPV] Fetching balance for wallet:', walletAddress);

  try {
    if (!walletAddress) {
      console.log('[RPV] No wallet address provided');
      return 0;
    }

    // Pad address to 32 bytes (remove 0x, pad to 64 chars)
    const paddedAddress = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const data = BALANCE_OF_SELECTOR + paddedAddress;

    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: RPV_TOKEN_ADDRESS,
            data: data,
          },
          'latest',
        ],
      }),
    });

    const json = await response.json();
    console.log('[RPV] RPC response:', JSON.stringify(json));

    if (json.error) {
      console.error('[RPV] RPC error:', json.error);
      return 0;
    }

    // Parse the hex result (it's a uint256 in wei)
    const balanceWei = BigInt(json.result || '0x0');
    // Convert from wei (18 decimals) to human-readable
    const balance = Number(balanceWei) / 1e18;

    console.log('[RPV] Balance wei:', balanceWei.toString(), '| Formatted:', balance);

    return balance;
  } catch (error) {
    console.error('[RPV] Error fetching balance:', error);
    return 0;
  }
}
