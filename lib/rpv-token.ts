import { createPublicClient, http, formatUnits, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';

// RPV Token contract on Base Sepolia
export const RPV_TOKEN_ADDRESS = '0x4a57Cd1C4235cb7Af37625bA59bA00beB2265312' as const;

// ERC-20 ABI for balanceOf
const erc20Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

// Create public client for Base Sepolia
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

/**
 * Get RPV token balance for a wallet address
 * @param walletAddress - The wallet address to check
 * @returns The token balance as a number (human-readable, not wei)
 */
export async function getRPVBalance(walletAddress: string): Promise<number> {
  try {
    if (!walletAddress) {
      return 0;
    }

    const balance = await client.readContract({
      address: RPV_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    });

    // RPV token uses 18 decimals (standard ERC-20)
    return Number(formatUnits(balance, 18));
  } catch (error) {
    console.error('Error fetching RPV balance:', error);
    return 0;
  }
}

/**
 * Get RPV token decimals (should be 18)
 */
export async function getRPVDecimals(): Promise<number> {
  try {
    const decimals = await client.readContract({
      address: RPV_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: 'decimals',
    });
    return decimals;
  } catch (error) {
    console.error('Error fetching RPV decimals:', error);
    return 18; // Default to 18
  }
}
