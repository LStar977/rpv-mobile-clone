// RPV Token contract on Base Sepolia
export const RPV_TOKEN_ADDRESS = '0x4a57Cd1C4235cb7Af37625bA59bA00beB2265312';

// Base Sepolia RPC endpoint
const RPC_URL = 'https://sepolia.base.org';

// ERC-20 balanceOf function selector: keccak256("balanceOf(address)")[:4]
const BALANCE_OF_SELECTOR = '0x70a08231';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [500, 1000, 2000]; // Exponential backoff

export interface RPVBalanceResult {
  balance: number;
  error: boolean;
  errorMessage?: string;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get RPV token balance for a wallet address using direct RPC call
 * Returns structured result with error flag for proper handling
 */
export async function getRPVBalance(walletAddress: string): Promise<RPVBalanceResult> {
  console.log('[RPV] Fetching balance for wallet:', walletAddress);

  if (!walletAddress) {
    console.log('[RPV] No wallet address provided');
    return { balance: 0, error: false };
  }

  const paddedAddress = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
  const data = BALANCE_OF_SELECTOR + paddedAddress;

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAYS[attempt - 1] || 2000;
        console.log(`[RPV] Retry attempt ${attempt}/${MAX_RETRIES} after ${delay}ms`);
        await sleep(delay);
      }

      const response = await fetchWithTimeout(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            { to: RPV_TOKEN_ADDRESS, data },
            'latest',
          ],
        }),
      });

      const json = await response.json();
      console.log('[RPV] RPC response:', JSON.stringify(json));

      if (json.error) {
        lastError = json.error.message || 'RPC error';
        console.error('[RPV] RPC error:', json.error);
        continue;
      }

      const balanceWei = BigInt(json.result || '0x0');
      const balance = Number(balanceWei) / 1e18;

      console.log('[RPV] Balance wei:', balanceWei.toString(), '| Formatted:', balance);
      return { balance, error: false };

    } catch (error: any) {
      lastError = error?.message || 'Network error';
      console.error(`[RPV] Fetch attempt ${attempt + 1} failed:`, error);
    }
  }

  console.error('[RPV] All retry attempts exhausted');
  return { balance: 0, error: true, errorMessage: lastError };
}
