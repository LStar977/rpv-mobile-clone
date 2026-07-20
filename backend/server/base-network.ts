import { ethers } from 'ethers';

// Base Network config - supports both mainnet and testnet
const isMainnet = process.env.BASE_NETWORK === 'mainnet';
export const BASE_CONFIG = {
  rpcUrl: isMainnet
    ? (process.env.BASE_RPC_URL || 'https://mainnet.base.org')
    : (process.env.BASE_RPC_URL || 'https://sepolia.base.org'),
  chainId: isMainnet ? 8453 : 84532,
  chainName: isMainnet ? 'Base Mainnet' : 'Base Sepolia',
};

// ProposalVoteTokenFactory ABI
export const FACTORY_ABI = [
  {
    type: 'function',
    name: 'createProposalToken',
    inputs: [
      { name: 'proposalId', type: 'string' },
      { name: 'maxVotes', type: 'uint256' }
    ],
    outputs: [{ type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getProposalToken',
    inputs: [{ name: 'proposalId', type: 'string' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasToken',
    inputs: [{ name: 'proposalId', type: 'string' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
];

// Soulbound Passport NFT Contract ABI
export const PASSPORT_SBT_ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'target_', type: 'address' },
      { name: 'tokenId_', type: 'uint256' },
      { name: 'uri_', type: 'string' },
      { name: 'nonce_', type: 'uint256' },
      { name: 'deadline_', type: 'uint256' },
      { name: 'signature_', type: 'bytes' }
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
];

// RepresentVoteToken (RPV) ABI - Simple ERC20
export const RPV_TOKEN_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferVoteToken',
    inputs: [
      { name: 'voter', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordVote',
    inputs: [
      { name: 'proposalId', type: 'string' },
      { name: 'voter', type: 'address' },
      { name: 'position', type: 'string' }
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hasVoted',
    inputs: [
      { name: 'proposalId', type: 'string' },
      { name: 'voter', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canVoteOnProposal',
    inputs: [
      { name: 'proposalId', type: 'string' },
      { name: 'voter', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

// Smart Wallet Contract ABI (basic ERC-4337 compatible wallet)
export const SMART_WALLET_ABI = [
  {
    inputs: [],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'dest', type: 'address' }, { internalType: 'bytes', name: 'func', type: 'bytes' }],
    name: 'execute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

export class BaseNetworkManager {
  private provider: ethers.JsonRpcProvider;
  private walletPrivateKey: string;
  private factoryAddress: string;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(BASE_CONFIG.rpcUrl);
    this.walletPrivateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || '';
    this.factoryAddress = process.env.FACTORY_ADDRESS || '';
    console.log('🔧 BaseNetworkManager initialized:', {
      factoryAddress: this.factoryAddress,
      hasPrivateKey: !!this.walletPrivateKey,
      provider: BASE_CONFIG.rpcUrl
    });
  }

  // Get provider for reading from Base
  getProvider() {
    return this.provider;
  }

  // Generate a deterministic smart wallet address and private key for a user
  // Based on user ID so it's always the same address and key
  async generateSmartWallet(userId?: string): Promise<{ address: string; privateKey: string }> {
    try {
      // Create a deterministic wallet from user ID
      const seed = userId || ethers.randomBytes(32);
      const mnemonic = ethers.Mnemonic.fromEntropy(typeof seed === 'string' ? ethers.toBeHex(ethers.id(seed)).padEnd(66, '0').slice(0, 66) : seed);
      const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonic);
      return {
        address: hdNode.address,
        privateKey: hdNode.privateKey,
      };
    } catch (error) {
      // Fallback to random wallet if deterministic fails
      const randomWallet = ethers.Wallet.createRandom();
      return {
        address: randomWallet.address,
        privateKey: randomWallet.privateKey,
      };
    }
  }

  // Verify wallet ownership by signing a message
  async verifyWalletSignature(address: string, message: string, signature: string): Promise<boolean> {
    try {
      const recovered = ethers.verifyMessage(message, signature);
      return recovered.toLowerCase() === address.toLowerCase();
    } catch {
      return false;
    }
  }

  // Get wallet balance on Base
  async getWalletBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0';
    }
  }

  // Transfer RPV tokens to a user (pre-minted tokens)
  async transferRPVToken(rpvTokenAddress: string, userWalletAddress: string, amount: number = 1): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.walletPrivateKey) {
        console.error('❌ Private key not configured for server wallet');
        return { success: false, error: 'Private key not configured' };
      }

      if (!rpvTokenAddress || rpvTokenAddress === '0x') {
        console.error('❌ Invalid RPV token address:', rpvTokenAddress);
        return { success: false, error: 'Invalid RPV token address' };
      }

      const wallet = new ethers.Wallet(this.walletPrivateKey, this.provider);
      console.log(`Server wallet address: ${wallet.address}`);

      const contract = new ethers.Contract(rpvTokenAddress, RPV_TOKEN_ABI, wallet);

      console.log(`🎫 Transferring RPV tokens to ${userWalletAddress}`);

      // Convert amount to wei (1 RPV = 10^18 wei with 18 decimals)
      const amountInWei = ethers.parseEther(amount.toString());

      // Call transfer instead of transferVoteToken - simpler standard ERC20 method
      const tx = await contract.transfer(userWalletAddress, amountInWei);
      console.log(`Transaction submitted: ${tx.hash}`);

      const receipt = await tx.wait();

      if (!receipt) {
        console.error('❌ No receipt received after waiting for transaction');
        return { success: false, error: 'Transaction failed - no receipt' };
      }

      if (receipt.status === 0) {
        console.error('❌ Transaction reverted');
        return { success: false, error: 'Transaction reverted' };
      }

      console.log(`✅ RPV tokens transferred! Tx: ${receipt.hash}, Block: ${receipt.blockNumber}`);

      return {
        success: true,
        txHash: receipt.hash,
      };
    } catch (error: any) {
      console.error('❌ Error transferring RPV token:', error?.message || String(error));
      console.error('Full error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to transfer RPV token'
      };
    }
  }

  // Get RPV token balance for a user
  async getRPVBalance(rpvTokenAddress: string, userAddress: string): Promise<string> {
    try {
      const contract = new ethers.Contract(rpvTokenAddress, RPV_TOKEN_ABI, this.provider);
      const balance = await contract.balanceOf(userAddress);
      return ethers.formatEther(balance);
    } catch (error: any) {
      console.error('❌ Error getting RPV balance:', error?.message || String(error));
      return '0';
    }
  }

  // Calculate exact gas cost needed for a vote transaction
  async calculateVoteGasCost(rpvTokenAddress: string, userAddress: string, voteAddress: string): Promise<{ success: boolean; gasCost?: bigint; gasUnits?: bigint; error?: string }> {
    try {
      const iface = new ethers.Interface(RPV_TOKEN_ABI);
      const oneTokenInWei = ethers.parseEther("1");
      const transferData = iface.encodeFunctionData('transfer', [voteAddress, oneTokenInWei]);

      // Create a mock transaction to estimate gas
      const mockTx = {
        from: userAddress,
        to: rpvTokenAddress,
        data: transferData,
        value: BigInt(0),
      };

      // Estimate gas needed for this transaction
      const gasUnits = await this.provider.estimateGas(mockTx);

      // Get current fee data
      const feeData = await this.provider.getFeeData();
      if (!feeData.maxFeePerGas) {
        return { success: false, error: 'Could not get gas price data' };
      }

      // Calculate total ETH needed: gasUnits * maxFeePerGas
      const gasCost = gasUnits * feeData.maxFeePerGas;

      console.log(`⛽ Gas estimation: ${gasUnits} units * ${ethers.formatEther(feeData.maxFeePerGas)} per unit = ${ethers.formatEther(gasCost)} ETH`);

      return { success: true, gasCost, gasUnits };
    } catch (error: any) {
      console.error('❌ Error calculating gas cost:', error?.message || String(error));
      return { success: false, error: error?.message || 'Failed to calculate gas' };
    }
  }

  // Send exact ETH to user for gas fees (calculated beforehand)
  async sendETHForGas(userAddress: string, requiredGas: bigint): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.walletPrivateKey) {
        return { success: false, error: 'Server wallet not configured' };
      }

      const serverWallet = new ethers.Wallet(this.walletPrivateKey, this.provider);

      // Add 50% buffer for safety (gas prices can fluctuate significantly)
      const gasWithBuffer = requiredGas + (requiredGas / BigInt(2));

      // Check if user already has enough ETH (including buffer)
      const userBalance = await this.provider.getBalance(userAddress);

      if (userBalance >= gasWithBuffer) {
        console.log(`✅ User already has enough ETH for gas (${ethers.formatEther(userBalance)} ETH, needed with buffer: ${ethers.formatEther(gasWithBuffer)} ETH)`);
        return { success: true };
      }

      console.log(`💰 Sending ${ethers.formatEther(gasWithBuffer)} ETH to user ${userAddress} for gas...`);

      const tx = await serverWallet.sendTransaction({
        to: userAddress,
        value: gasWithBuffer,
      });

      const receipt = await tx.wait();
      console.log(`✅ Sent ETH for gas! Tx: ${receipt?.hash}`);

      return { success: true };
    } catch (error: any) {
      console.error('❌ Error sending ETH for gas:', error?.message || String(error));
      return { success: false, error: error?.message || 'Failed to send ETH' };
    }
  }

  // Vote using relay: sign with user's key, broadcast with server's wallet (server pays gas)
  async voteWithRelayPattern(rpvTokenAddress: string, userPrivateKey: string, userAddress: string, position: 'support' | 'oppose' | 'multiple-choice', proposalId: string, optionAddress?: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // For multiple-choice, use the provided option address; otherwise create deterministic address
      let voteAddress: string;
      if (position === 'multiple-choice' && optionAddress) {
        voteAddress = optionAddress;
      } else {
        // Create deterministic vote address based on proposal ID and position
        const voteString = `${proposalId}-${position}`;
        const voteAddressHash = ethers.keccak256(ethers.toUtf8Bytes(voteString));
        voteAddress = ethers.getAddress('0x' + voteAddressHash.slice(-40));
      }

      // Calculate exact gas cost needed for this vote
      const gasCostResult = await this.calculateVoteGasCost(rpvTokenAddress, userAddress, voteAddress);
      if (!gasCostResult.success || !gasCostResult.gasCost) {
        return { success: false, error: 'Failed to calculate gas cost' };
      }

      // Send user exactly the amount of ETH needed (plus 10% buffer)
      const gasResult = await this.sendETHForGas(userAddress, gasCostResult.gasCost);
      if (!gasResult.success) {
        return { success: false, error: 'Failed to send ETH for gas fees' };
      }

      console.log(`🗳️ User voting on proposal ${proposalId}: relaying transfer from ${userAddress} to ${position} address`);

      // Get current nonce for the user's address
      const nonce = await this.provider.getTransactionCount(userAddress);

      // Create contract interface to build transaction data
      const iface = new ethers.Interface(RPV_TOKEN_ABI);
      const oneTokenInWei = ethers.parseEther("1");

      // Encode the transfer call
      const transferData = iface.encodeFunctionData('transfer', [voteAddress, oneTokenInWei]);

      // Get fee data for EIP-1559 transaction
      const feeData = await this.provider.getFeeData();

      // Use estimated gas units (add 20% buffer for safety)
      const gasLimitWithBuffer = gasCostResult.gasUnits ? (gasCostResult.gasUnits * BigInt(120)) / BigInt(100) : BigInt(100000);

      // Create unsigned transaction (EIP-1559)
      const unsignedTx = {
        to: rpvTokenAddress,
        data: transferData,
        value: BigInt(0),
        gasLimit: gasLimitWithBuffer,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        nonce: nonce,
        chainId: BASE_CONFIG.chainId,
      };

      // Sign transaction with user's private key
      const userWallet = new ethers.Wallet(userPrivateKey);
      const signedTx = await userWallet.signTransaction(unsignedTx);

      console.log(`✅ Transaction signed with user's key, now broadcasting...`);

      // Broadcast the signed transaction directly (raw transaction)
      console.log(`Broadcasting signed transaction: ${signedTx.substring(0, 66)}...`);

      let txResponse;
      try {
        txResponse = await this.provider.broadcastTransaction(signedTx);
      } catch (broadcastError: any) {
        console.error('❌ Broadcast failed:', broadcastError?.message);
        throw broadcastError;
      }

      console.log(`Transaction hash: ${txResponse.hash}`);
      const receipt = await txResponse.wait();

      if (!receipt) {
        console.error('❌ No receipt received after waiting for transaction');
        return { success: false, error: 'Transaction failed - no receipt' };
      }

      if (receipt.status === 0) {
        console.error('❌ Transaction reverted');
        return { success: false, error: 'Transaction reverted' };
      }

      console.log(`✅ Vote recorded via relay! Tx: ${receipt.hash}, Block: ${receipt.blockNumber}, Position: ${position}`);

      return {
        success: true,
        txHash: receipt.hash,
      };
    } catch (error: any) {
      console.error('❌ Error voting with relay:', error?.message || String(error));
      return {
        success: false,
        error: error?.message || 'Failed to record vote'
      };
    }
  }

  // Transfer RPV token to support or oppose address for voting (OLD - server vault)
  async voteByTransferringToken(rpvTokenAddress: string, userWalletAddress: string, position: 'support' | 'oppose', proposalId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.walletPrivateKey) {
        return { success: false, error: 'Private key not configured' };
      }

      const wallet = new ethers.Wallet(this.walletPrivateKey, this.provider);
      const contract = new ethers.Contract(rpvTokenAddress, RPV_TOKEN_ABI, wallet);

      // Create deterministic vote address based on proposal ID and position
      const voteString = `${proposalId}-${position}`;
      const voteAddressHash = ethers.keccak256(ethers.toUtf8Bytes(voteString));
      const voteAddress = ethers.getAddress('0x' + voteAddressHash.slice(-40)); // Get last 40 chars as address

      console.log(`🗳️ Voting on proposal ${proposalId}: transferring 1 RPV to ${position} address`);

      // Transfer 1 token to vote address (1 * 10^18)
      const oneTokenInWei = ethers.parseEther("1");
      const tx = await contract.transfer(voteAddress, oneTokenInWei);
      const receipt = await tx.wait();

      console.log(`✅ Vote recorded via transfer! Tx: ${receipt?.hash}, Position: ${position}`);

      return {
        success: true,
        txHash: receipt?.hash,
      };
    } catch (error: any) {
      console.error('❌ Error voting:', error?.message || String(error));
      return {
        success: false,
        error: error?.message || 'Failed to record vote'
      };
    }
  }

  // Record a vote on-chain for a proposal
  async recordVoteOnChain(rpvTokenAddress: string, proposalId: string, userWalletAddress: string, position: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.walletPrivateKey) {
        return { success: false, error: 'Private key not configured' };
      }

      const wallet = new ethers.Wallet(this.walletPrivateKey, this.provider);
      const contract = new ethers.Contract(rpvTokenAddress, RPV_TOKEN_ABI, wallet);

      console.log(`📝 Recording vote on-chain for proposal ${proposalId}`);

      const tx = await contract.recordVote(proposalId, userWalletAddress, position);
      const receipt = await tx.wait();

      console.log(`✅ Vote recorded on-chain! Tx: ${receipt?.hash}`);

      return {
        success: true,
        txHash: receipt?.hash,
      };
    } catch (error: any) {
      console.error('❌ Error recording vote:', error?.message || String(error));
      return {
        success: false,
        error: error?.message || 'Failed to record vote'
      };
    }
  }

  // Deploy the RPV token contract (call this once)
  async deployRPVToken(): Promise<string | null> {
    try {
      if (!this.walletPrivateKey) {
        console.error('❌ Private key not configured');
        return null;
      }

      const wallet = new ethers.Wallet(this.walletPrivateKey, this.provider);
      console.log(`🚀 Deploying RepresentVoteToken (RPV) contract`);

      // Use ERC20 standard constructor (no parameters needed)
      const contractFactory = new ethers.ContractFactory(
        RPV_TOKEN_ABI,
        '0x', // Placeholder - we'd use compiled bytecode in production
        wallet
      );

      console.log(`⚠️  RPV deployment requires compiled bytecode`);
      console.log(`📝  In production, compile and deploy RepresentVoteToken.sol`);
      console.log(`🔗 For now, use the RPV token address from your deployment`);

      return null;
    } catch (error: any) {
      console.error('❌ Error deploying RPV:', error?.message || String(error));
      return null;
    }
  }

  // Generate deterministic address for a proposal option (for multiple-choice voting)
  async generateDeterministicAddress(proposalId: string, optionIndex: number): Promise<string> {
    try {
      const wallet = new ethers.Wallet(this.walletPrivateKey || ethers.toBeHex(0, 32), this.provider);

      console.log(`🚀 Generating deterministic address for proposal ${proposalId}, option ${optionIndex}`);

      const addressHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['string', 'uint256', 'address', 'string'],
          [proposalId, optionIndex, wallet.address, 'OPTION_VOTE']
        )
      );

      const address = ethers.getAddress('0x' + addressHash.slice(-40));

      console.log(`✅ Option address: ${address}`);
      return address;

    } catch (error: any) {
      console.error('❌ Error generating option address:', error?.message || String(error));
      throw error;
    }
  }

  // Fallback: Create a deterministic token address
  async createProposalVoteToken(proposalId: string): Promise<string | null> {
    try {
      if (!this.walletPrivateKey) {
        console.error('❌ Private key not configured');
        return null;
      }

      const wallet = new ethers.Wallet(this.walletPrivateKey, this.provider);

      console.log(`🚀 Generating deterministic token address for proposal: ${proposalId}`);

      const tokenAddressHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['string', 'address', 'string'],
          [proposalId, wallet.address, 'VOTE_TOKEN']
        )
      );

      const tokenAddress = ethers.getAddress('0x' + tokenAddressHash.slice(-40));

      console.log(`✅ Token address: ${tokenAddress}`);
      return tokenAddress;

    } catch (error: any) {
      console.error('❌ Error generating token address:', error?.message || String(error));
      return null;
    }
  }

  // Get vote token address for a proposal
  async getProposalVoteToken(proposalId: string): Promise<string | null> {
    try {
      if (!this.factoryAddress) {
        console.warn('Factory address not configured');
        return null;
      }

      // Mock implementation - real version would query the factory contract
      console.log(`Fetching vote token for proposal ${proposalId}`);
      return null;
    } catch (error) {
      console.error('Error fetching proposal vote token:', error);
      return null;
    }
  }

  // Mint soulbound passport NFT using EIP-712 signature
  async mintPassportNFT(
    passportContractAddress: string,
    userWalletAddress: string,
    tokenId: string,
    uri: string = 'ipfs://passport'
  ): Promise<{ success: boolean; txHash?: string; tokenId?: string; error?: string }> {
    try {
      if (!this.walletPrivateKey) {
        return { success: false, error: 'Private key not configured' };
      }

      // Check if contract is deployed (not all zeros)
      if (passportContractAddress === '0x0000000000000000000000000000000000000000') {
        // Test/demo mode - mock the minting
        console.log(`🧪 TEST MODE: Simulating passport mint for ${userWalletAddress}, tokenId=${tokenId}`);

        // Generate a mock transaction hash
        const mockTxHash = '0x' + ethers.keccak256(
          ethers.toUtf8Bytes(`${userWalletAddress}-${tokenId}-${Date.now()}`)
        ).substring(2, 66);

        console.log(`✅ Passport minted (test mode)! Tx: ${mockTxHash}, TokenId: ${tokenId}`);

        return {
          success: true,
          txHash: mockTxHash,
          tokenId: tokenId,
        };
      }

      const wallet = new ethers.Wallet(this.walletPrivateKey, this.provider);

      // Create a read-only contract instance to fetch nonce
      const readOnlyContract = new ethers.Contract(passportContractAddress, [
        'function nonces(address) view returns (uint256)'
      ], this.provider);

      // Fetch the current nonce for this user from the contract
      let nonce = await readOnlyContract.nonces(userWalletAddress);
      console.log(`📋 Current nonce for ${userWalletAddress}: ${nonce}`);

      // Try nonce + 1 as a fallback since nonce 0 may have been used in a failed tx
      nonce = BigInt(nonce) + BigInt(1);
      console.log(`📋 Using nonce: ${nonce} (incremented for safety)`);

      const contract = new ethers.Contract(passportContractAddress, PASSPORT_SBT_ABI, wallet);

      console.log(`🎫 Minting passport NFT for ${userWalletAddress}, tokenId=${tokenId}`);

      // Convert to proper types
      const tokenIdBig = BigInt(tokenId);
      const nonceBig = BigInt(nonce);
      const deadlineBig = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Use ethers' built-in EIP-712 typing
      const domain = {
        name: 'RepresentPassport',
        version: '1',
        chainId: BASE_CONFIG.chainId,
        verifyingContract: passportContractAddress,
      };

      const types = {
        Mint: [
          { name: 'target', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'uri', type: 'string' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      };

      const value = {
        target: userWalletAddress,
        tokenId: tokenIdBig,
        uri: uri,
        nonce: nonceBig,
        deadline: deadlineBig,
      };

      console.log(`🔐 Signing with EIP-712...`);
      const signature = await wallet.signTypedData(domain, types, value);

      console.log(`📝 Signature: ${signature}`);
      console.log(`🎫 Calling mint: tokenId=${tokenIdBig}, nonce=${nonceBig}`);

      // Call the mint function
      const tx = await contract.mint(
        userWalletAddress,
        tokenIdBig,
        uri,
        nonceBig,
        deadlineBig,
        signature
      );

      console.log(`⏳ TX: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`✅ Minted! Tx: ${receipt?.hash}`);

      return {
        success: true,
        txHash: receipt?.hash,
        tokenId: tokenId,
      };
    } catch (error: any) {
      console.error('❌ Error minting passport:', error?.message || String(error));
      return {
        success: false,
        error: error?.message || 'Failed to mint passport NFT'
      };
    }
  }

  // Helper to wait for provider to be ready
  async waitForProvider() {
    let attempts = 0;
    while (attempts < 5) {
      try {
        const network = await this.provider.getNetwork();
        console.log(`Connected to Base network: ${network.name}`);
        return true;
      } catch (error) {
        attempts++;
        console.warn(`Provider not ready, attempt ${attempts}/5`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    console.error('Failed to connect to Base network');
    return false;
  }
}

export const baseNetwork = new BaseNetworkManager();
