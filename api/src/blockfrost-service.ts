const fetch = require('node-fetch');
const { DatabaseService } = require('./database-service');

const BLOCKFROST_API_KEY = 'mainnetKDR7gGfvHy85Mqr4nYtfjoXq7fX8R1Bu';
const BLOCKFROST_BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';

interface TokenHolder {
  address: string;
  quantity: string;
  stake_address?: string | null;
}

interface AssetAddress {
  address: string;
  quantity: string;
}

interface AddressInfo {
  stake_address: string | null;
  type: string;
}

interface TransactionUtxo {
  tx_hash: string;
  block: string;
  block_time: number;
  outputs: Array<{
    address: string;
    amount: Array<{
      unit: string;
      quantity: string;
    }>;
  }>;
}

export class BlockfrostService {
  private dbService: any;

  constructor() {
    this.dbService = new DatabaseService();
  }

  // Helper method to identify likely liquidity pools
  private isLikelyLiquidityPool(holder: TokenHolder, allHolders: TokenHolder[]): boolean {
    // Liquidity pools typically:
    // 1. Hold large amounts (already filtered for >7%)
    // 2. Have no stake address (script addresses)
    // 3. Have addresses that start with certain patterns

    if (!holder.stake_address) {
      return true; // Script addresses are likely liquidity pools
    }

    // Check for common DEX patterns in address
    const address = holder.address.toLowerCase();
    if (address.includes('script') ||
        address.startsWith('addr1z') || // Script addresses often start with addr1z
        address.startsWith('addr1x')) { // Some script addresses start with addr1x
      return true;
    }

    return false;
  }

  private async makeRequest(endpoint: string): Promise<any> {
    const response = await fetch(`${BLOCKFROST_BASE_URL}${endpoint}`, {
      headers: {
        'project_id': BLOCKFROST_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Blockfrost API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Auto-detect primary token on a policy
  async getPrimaryTokenOnPolicy(policyId: string): Promise<string | null> {
    try {
      // Get all assets for this policy
      const assets = await this.makeRequest(`/assets/policy/${policyId}`);

      if (!assets || assets.length === 0) {
        return null;
      }

      // If only one asset, return it
      if (assets.length === 1) {
        return assets[0].asset;
      }

      // Find the asset with the most holders (most likely the main token)
      let primaryAsset = null;
      let maxHolders = 0;

      for (const asset of assets.slice(0, 5)) { // Check first 5 assets to avoid rate limits
        try {
          const addresses = await this.makeRequest(`/assets/${asset.asset}/addresses`);
          if (addresses.length > maxHolders) {
            maxHolders = addresses.length;
            primaryAsset = asset.asset;
          }
        } catch (error) {
          console.warn(`Could not check holders for asset ${asset.asset}:`, error);
        }
      }

      return primaryAsset;
    } catch (error) {
      console.error(`Error finding primary token for policy ${policyId}:`, error);
      return null;
    }
  }

  // Get all addresses holding a specific token
  async getTokenHolders(policyId: string, assetName: string = ''): Promise<TokenHolder[]> {
    let asset: string;

    if (assetName) {
      asset = `${policyId}${assetName}`;
    } else {
      // Auto-detect primary token
      const primaryAsset = await this.getPrimaryTokenOnPolicy(policyId);
      if (!primaryAsset) {
        console.log(`No tokens found for policy ${policyId}`);
        return [];
      }
      asset = primaryAsset;
      console.log(`Auto-detected primary token: ${asset}`);
    }

    try {
      const addresses: AssetAddress[] = await this.makeRequest(`/assets/${asset}/addresses`);

      const holders: TokenHolder[] = [];

      // Get stake address for each holder
      for (const addr of addresses) {
        try {
          const addressInfo: AddressInfo = await this.makeRequest(`/addresses/${addr.address}`);
          holders.push({
            address: addr.address,
            quantity: addr.quantity,
            stake_address: addressInfo.stake_address
          });
        } catch (error) {
          console.warn(`Could not get stake address for ${addr.address}:`, error);
          holders.push({
            address: addr.address,
            quantity: addr.quantity,
            stake_address: null
          });
        }
      }

      return holders;
    } catch (error) {
      console.error(`Error getting token holders for ${asset}:`, error);
      return [];
    }
  }

  // Get recent transactions for a token to detect coordinated activity
  async getTokenTransactions(policyId: string, assetName: string = '', limit: number = 100): Promise<TransactionUtxo[]> {
    let asset: string;

    if (assetName) {
      asset = `${policyId}${assetName}`;
    } else {
      // Auto-detect primary token
      const primaryAsset = await this.getPrimaryTokenOnPolicy(policyId);
      if (!primaryAsset) {
        console.log(`No tokens found for policy ${policyId} (transactions)`);
        return [];
      }
      asset = primaryAsset;
    }

    try {
      const transactions = await this.makeRequest(`/assets/${asset}/transactions?count=${limit}&order=desc`);

      const detailedTxs: TransactionUtxo[] = [];

      // Get detailed info for each transaction
      for (const tx of transactions.slice(0, 20)) { // Limit to avoid rate limits
        try {
          const txUtxos = await this.makeRequest(`/txs/${tx.tx_hash}/utxos`);
          const txInfo = await this.makeRequest(`/txs/${tx.tx_hash}`);

          detailedTxs.push({
            tx_hash: tx.tx_hash,
            block: txInfo.block,
            block_time: txInfo.block_time,
            outputs: txUtxos.outputs
          });
        } catch (error) {
          console.warn(`Could not get details for tx ${tx.tx_hash}:`, error);
        }
      }

      return detailedTxs;
    } catch (error) {
      console.error(`Error getting token transactions for ${asset}:`, error);
      return [];
    }
  }

  // Analyze token for suspicious patterns
  async analyzeToken(policyId: string, assetName: string = '') {
    console.log(`Analyzing token: ${policyId}${assetName}`);

    let autoDetectedAsset: string | undefined;
    let tokenInfo: any = null;

    // First, check database for known token info
    try {
      tokenInfo = await this.dbService.getTokenByPolicyId(policyId);
      if (tokenInfo) {
        console.log(`Found token in database: ${tokenInfo.ticker || tokenInfo.name || 'Unknown'}`);
        if (!assetName && tokenInfo.asset_name) {
          assetName = tokenInfo.asset_name;
          console.log(`Using database asset name: ${assetName}`);
        }
      }
    } catch (error) {
      console.warn('Database lookup failed, continuing with auto-detection:', error);
    }

    // If no asset name provided and not found in database, auto-detect the primary token
    if (!assetName) {
      const primaryAsset = await this.getPrimaryTokenOnPolicy(policyId);
      if (!primaryAsset) {
        return {
          policyId,
          assetName,
          error: 'No tokens found for this policy ID',
          riskScore: 0,
          patterns: []
        };
      }
      autoDetectedAsset = primaryAsset;

      // Extract asset name from full asset ID
      assetName = primaryAsset.replace(policyId, '');
      console.log(`Auto-detected primary token: ${primaryAsset}, asset name: ${assetName}`);
    }

    const holders = await this.getTokenHolders(policyId, assetName);
    const transactions = await this.getTokenTransactions(policyId, assetName);

    if (holders.length === 0) {
      return {
        policyId,
        assetName,
        error: 'No holders found or token does not exist',
        riskScore: 0,
        patterns: []
      };
    }

    const analysis = this.performRiskAnalysis(holders, transactions);

    const result = {
      policyId,
      assetName,
      ...analysis,
      holders: holders.slice(0, 100), // Return top 100 holders for better analysis
      recentTransactions: transactions.slice(0, 5)
    };

    // Add auto-detected asset info if applicable
    if (autoDetectedAsset) {
      (result as any).autoDetectedAsset = autoDetectedAsset;
    }

    // Add database token info if available
    if (tokenInfo) {
      (result as any).databaseInfo = {
        ticker: tokenInfo.ticker,
        name: tokenInfo.name,
        volume_24h: tokenInfo.volume_24h,
        price_usd: tokenInfo.price_usd,
        market_cap: tokenInfo.market_cap
      };
    }

    return result;
  }

  // Advanced wallet relationship analysis
  async analyzeWalletRelationships(holders: TokenHolder[], policyId: string, assetName: string): Promise<any> {
    const asset = assetName ? `${policyId}${assetName}` : await this.getPrimaryTokenOnPolicy(policyId);
    if (!asset) return { relationships: [], nonBuyers: [], suspiciousPatterns: [] };

    console.log(`🔍 Analyzing wallet relationships for ${holders.length} holders...`);

    const relationships = [];
    const nonBuyers = [];
    const suspiciousPatterns = [];
    const walletTransactions = new Map();

    // Analyze top 20 holders (to avoid rate limits with premium Blockfrost)
    const topHolders = holders.slice(0, 20);

    for (let i = 0; i < topHolders.length; i++) {
      const holder = topHolders[i];
      console.log(`📊 Analyzing holder ${i + 1}/${topHolders.length}: ${holder.address.substring(0, 12)}...`);

      try {
        // Get all transactions for this address
        const addressTxs = await this.getAddressTransactions(holder.address, asset);
        walletTransactions.set(holder.address, addressTxs);

        // Check if wallet received tokens without buying
        const nonBuyerAnalysis = this.analyzeNonBuyer(addressTxs, asset, holder.address);
        if (nonBuyerAnalysis.isNonBuyer) {
          nonBuyers.push({
            address: holder.address,
            quantity: holder.quantity,
            ...nonBuyerAnalysis
          });
        }

        // Check for direct transfers to other top holders
        const transfers = this.findDirectTransfers(addressTxs, topHolders, asset);
        if (transfers.length > 0) {
          relationships.push({
            from: holder.address,
            transfers: transfers
          });
        }

        // Rate limiting - wait between requests
        if (i % 5 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.warn(`Error analyzing holder ${holder.address}:`, error);
      }
    }

    // Detect coordinated patterns
    const coordinatedPatterns = this.detectCoordinatedBehavior(walletTransactions, topHolders);

    return {
      relationships,
      nonBuyers,
      suspiciousPatterns: coordinatedPatterns,
      analysisStats: {
        totalHoldersAnalyzed: topHolders.length,
        relationshipsFound: relationships.length,
        nonBuyersFound: nonBuyers.length,
        suspiciousPatternsFound: coordinatedPatterns.length
      }
    };
  }

  // Get all transactions for an address involving the token
  async getAddressTransactions(address: string, asset: string, limit: number = 30): Promise<any[]> {
    try {
      const transactions = await this.makeRequest(`/addresses/${address}/transactions?count=${limit}&order=desc`);

      // Filter for transactions involving our token
      const tokenTxs = [];
      for (const tx of transactions.slice(0, 10)) { // Limit to avoid rate limits
        try {
          const txDetails = await this.makeRequest(`/txs/${tx.tx_hash}/utxos`);

          // Check if transaction involves our token
          const hasToken = txDetails.outputs.some((output: any) =>
            output.amount.some((amount: any) => amount.unit === asset)
          ) || txDetails.inputs.some((input: any) =>
            input.amount.some((amount: any) => amount.unit === asset)
          );

          if (hasToken) {
            tokenTxs.push({
              tx_hash: tx.tx_hash,
              block_time: tx.block_time,
              details: txDetails
            });
          }
        } catch (error) {
          console.warn(`Error getting tx details for ${tx.tx_hash}:`, error);
        }
      }

      return tokenTxs;
    } catch (error) {
      console.error(`Error getting transactions for ${address}:`, error);
      return [];
    }
  }

  // Analyze if wallet received tokens without buying
  analyzeNonBuyer(transactions: any[], asset: string, address: string): any {
    let hasReceivedTokens = false;
    let hasBoughtTokens = false;
    let firstReceived = null;
    let receivedSources = [];

    for (const tx of transactions) {
      const outputs = tx.details?.outputs || [];
      const inputs = tx.details?.inputs || [];

      // Check if this address received tokens in outputs
      const receivedInTx = outputs.find((output: any) =>
        output.address === address &&
        output.amount.some((amount: any) => amount.unit === asset)
      );

      if (receivedInTx) {
        hasReceivedTokens = true;
        if (!firstReceived) {
          firstReceived = tx.block_time;
        }

        // Check if this looks like a purchase (has ADA input from same address)
        const hasAdaInput = inputs.some((input: any) =>
          input.address === address &&
          input.amount.some((amount: any) => amount.unit === 'lovelace')
        );

        if (hasAdaInput) {
          hasBoughtTokens = true;
        } else {
          // Find who sent the tokens
          const senderInput = inputs.find((input: any) =>
            input.amount.some((amount: any) => amount.unit === asset)
          );
          if (senderInput) {
            receivedSources.push(senderInput.address);
          }
        }
      }
    }

    return {
      isNonBuyer: hasReceivedTokens && !hasBoughtTokens,
      hasReceivedTokens,
      hasBoughtTokens,
      firstReceived,
      receivedSources: [...new Set(receivedSources)] // Remove duplicates
    };
  }

  // Find direct transfers between top holders
  findDirectTransfers(transactions: any[], topHolders: TokenHolder[], asset: string): any[] {
    const transfers = [];
    const topHolderAddresses = new Set(topHolders.map(h => h.address));

    for (const tx of transactions) {
      const outputs = tx.details?.outputs || [];

      // Find token transfers to other top holders
      for (const output of outputs) {
        if (topHolderAddresses.has(output.address)) {
          const tokenAmount = output.amount.find((amount: any) => amount.unit === asset);
          if (tokenAmount) {
            transfers.push({
              to: output.address,
              amount: tokenAmount.quantity,
              tx_hash: tx.tx_hash,
              block_time: tx.block_time
            });
          }
        }
      }
    }

    return transfers;
  }

  // Detect coordinated behavior patterns
  detectCoordinatedBehavior(walletTransactions: Map<string, any[]>, topHolders: TokenHolder[]): any[] {
    const patterns: any[] = [];

    // Group transactions by block time to find coordinated activity
    const timeGroups = new Map();

    walletTransactions.forEach((transactions, address) => {
      transactions.forEach(tx => {
        const timeKey = Math.floor(tx.block_time / 300) * 300; // 5-minute windows
        if (!timeGroups.has(timeKey)) {
          timeGroups.set(timeKey, []);
        }
        timeGroups.get(timeKey).push({ address, tx });
      });
    });

    // Find time windows with multiple wallet activity
    timeGroups.forEach((txs, timeKey) => {
      if (txs.length >= 3) { // 3+ wallets active in same 5-min window
        const uniqueWallets = new Set(txs.map((t: any) => t.address));
        if (uniqueWallets.size >= 3) {
          patterns.push({
            type: 'coordinated_timing',
            timeWindow: timeKey,
            walletsInvolved: Array.from(uniqueWallets),
            transactionCount: txs.length,
            suspicionLevel: uniqueWallets.size >= 5 ? 'high' : 'medium'
          });
        }
      }
    });

    return patterns;
  }

  private performRiskAnalysis(holders: TokenHolder[], transactions: TransactionUtxo[]) {
    const patterns: string[] = [];
    let riskScore = 0;

    // Known infrastructure addresses to exclude from risk analysis
    const knownInfrastructure = new Set([
      'addr1w8qmxkacjdffxah0l3qg8hq2pmvs58q8lcy42zy9kda2ylc6dy5r4', // burn wallet
      'addr1zyupekdkyr8f6lrnm4zulcs8juwv080hjfgsqvgkp98kkdkrxp0e2m4utglc7hmzkuta3e2td72cdjq9m9xlfn6rz8vq86l65l' // vesting wallet
    ]);

    // Calculate total supply - assume 1 billion if we only see top 100 holders
    const observedSupply = holders.reduce((sum, h) => sum + parseInt(h.quantity), 0);
    const assumedTotalSupply = holders.length >= 100 && observedSupply < 1000000000 ? 1000000000 : observedSupply;

    // Identify liquidity pools and infrastructure
    const liquidityPools: TokenHolder[] = [];
    const infrastructureHolders: TokenHolder[] = [];
    const regularHolders: TokenHolder[] = [];

    holders.forEach(holder => {
      if (knownInfrastructure.has(holder.address)) {
        infrastructureHolders.push(holder);
      } else {
        const holderPercentage = (parseInt(holder.quantity) / assumedTotalSupply) * 100;
        // Identify liquidity pools: large holders (>7%) with specific patterns
        if (holderPercentage > 7) {
          // Check if this looks like a liquidity pool
          const isLikelyLiquidityPool = this.isLikelyLiquidityPool(holder, holders);
          if (isLikelyLiquidityPool) {
            liquidityPools.push(holder);
          } else {
            regularHolders.push(holder);
          }
        } else {
          regularHolders.push(holder);
        }
      }
    });

    // Calculate supplies
    const liquiditySupply = liquidityPools.reduce((sum, h) => sum + parseInt(h.quantity), 0);
    const infrastructureSupply = infrastructureHolders.reduce((sum, h) => sum + parseInt(h.quantity), 0);
    const regularSupply = regularHolders.reduce((sum, h) => sum + parseInt(h.quantity), 0);
    const circulatingSupply = assumedTotalSupply - infrastructureSupply; // Include liquidity in circulation

    // Log findings
    if (infrastructureHolders.length > 0) {
      const infraPercentage = (infrastructureSupply / assumedTotalSupply) * 100;
      patterns.push(`Infrastructure holds ${infraPercentage.toFixed(1)}% (${infrastructureHolders.length} addresses) - EXCLUDED from risk`);
    }

    if (liquidityPools.length > 0) {
      const liquidityPercentage = (liquiditySupply / assumedTotalSupply) * 100;
      patterns.push(`Liquidity pools hold ${liquidityPercentage.toFixed(1)}% (${liquidityPools.length} pools) - EXCLUDED from concentration risk`);
    }

    // 1. Check for concentration using regular holders only (excluding liquidity pools)
    const sortedRegularHolders = regularHolders.sort((a, b) => parseInt(b.quantity) - parseInt(a.quantity));
    const topRegularHolderPercentage = circulatingSupply > 0 ? (parseInt(sortedRegularHolders[0]?.quantity || '0') / circulatingSupply) * 100 : 0;

    if (topRegularHolderPercentage > 9) {
      patterns.push(`Top regular holder owns ${topRegularHolderPercentage.toFixed(1)}% of circulating supply`);
      riskScore += Math.min(5, topRegularHolderPercentage / 2); // Up to 5 points
    }

    // 2. Check for stake address clustering (using regular holders only)
    const stakeGroups = new Map<string, TokenHolder[]>();
    regularHolders.forEach(holder => {
      if (holder.stake_address) {
        if (!stakeGroups.has(holder.stake_address)) {
          stakeGroups.set(holder.stake_address, []);
        }
        stakeGroups.get(holder.stake_address)!.push(holder);
      }
    });

    // Find suspicious stake clusters
    for (const [stakeAddr, group] of stakeGroups) {
      if (group.length > 3) { // Same stake controls 4+ addresses
        const clusterSupply = group.reduce((sum, h) => sum + parseInt(h.quantity), 0);
        const clusterPercentage = circulatingSupply > 0 ? (clusterSupply / circulatingSupply) * 100 : 0;

        if (clusterPercentage > 5) {
          patterns.push(`Stake cluster ${stakeAddr.slice(0, 10)}... controls ${group.length} addresses (${clusterPercentage.toFixed(1)}% of circulating supply)`);
          riskScore += Math.min(3, group.length / 2);
        }
      }
    }

    // 3. Check for coordinated transactions (same block)
    const blockGroups = new Map<string, TransactionUtxo[]>();
    transactions.forEach(tx => {
      if (!blockGroups.has(tx.block)) {
        blockGroups.set(tx.block, []);
      }
      blockGroups.get(tx.block)!.push(tx);
    });

    for (const [block, txs] of blockGroups) {
      if (txs.length >= 3) { // 3+ transactions in same block
        patterns.push(`${txs.length} coordinated transactions in block ${block}`);
        riskScore += Math.min(2, txs.length / 3);
      }
    }

    // 4. Check for identical amounts (using regular holders only)
    const amounts = regularHolders.map(h => h.quantity);
    const amountCounts = new Map<string, number>();
    amounts.forEach(amount => {
      amountCounts.set(amount, (amountCounts.get(amount) || 0) + 1);
    });

    for (const [amount, count] of amountCounts) {
      if (count >= 5 && parseInt(amount) > 0) { // 5+ holders with exact same amount
        patterns.push(`${count} regular wallets hold identical amount: ${amount}`);
        riskScore += Math.min(2, count / 5);
      }
    }

    // Cap risk score at 10
    riskScore = Math.min(10, riskScore);

    return {
      riskScore: Math.round(riskScore * 10) / 10, // Round to 1 decimal
      patterns,
      topHolderPercentage: Math.round(topRegularHolderPercentage * 10) / 10,
      stakeClusters: stakeGroups.size,
      coordinatedBlocks: Array.from(blockGroups.values()).filter(txs => txs.length >= 3).length,
      totalHolders: holders.length,
      regularHolders: regularHolders.length,
      liquidityPools: liquidityPools.length,
      infrastructureHolders: infrastructureHolders.length,
      assumedTotalSupply,
      observedSupply,
      circulatingSupply,
      liquiditySupply,
      infrastructureSupply
    };
  }
}
