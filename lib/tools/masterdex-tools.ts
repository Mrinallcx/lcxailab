import { tool } from 'ai';
import { z } from 'zod';

interface MasterDexTrade {
  type: string;
  transType: string;
  price: number;
  blockNumber: number;
  price1: number;
  token0Id: string;
  amountBase: number;
  amountQuote?: number;
  symbol0: string;
  symbol1: string;
  token0Price: number;
  token1Price: number;
  tnxvalue: number;
  token0: {
    decimals: number | string;
    derivedETH: number;
    id: string;
    name: string;
    symbol: string;
  };
  token1: {
    decimals: number;
    derivedETH: number;
    id: string;
    name: string;
    symbol: string;
  };
  account: string;
  bottrade: boolean;
  txnDetail: string;
  time: string;
  symbol: string;
  pairId: string;
  feeTier: number;
  chain: string;
}

export const masterdexBigSwapsTool = tool({
  description: 'Fetch big swaps (large trades) happening on multiple blockchains from MasterDex. Supports Ethereum, Base, Optimism, Polygon, Arbitrum, BNB, and Blast. Optionally filter by token symbol, pair, chain, and minimum value.',
  parameters: z.object({
    chain: z.enum(['ethereum', 'base', 'optimism', 'polygon', 'arbitrum', 'bnb', 'blast']).optional().describe('Blockchain to fetch data from. If not specified, returns data from all supported chains.'),
    token: z.string().optional().describe('Token symbol to filter for (case-insensitive, substring match, matches either side of the pair)'),
    pair: z.string().optional().describe('Pair symbol to filter for, e.g., USDC/WETH (case-insensitive, any order)'),
    minValue: z.number().optional().describe('Minimum transaction value in USD'),
    limit: z.number().optional().describe('Maximum number of results to return'),
  }),
  execute: async ({ chain, token, pair, minValue, limit }: { chain?: string; token?: string; pair?: string; minValue?: number; limit?: number }) => {
    try {
      // Determine the API endpoint based on whether a specific chain is requested
      let url: string;
      if (chain) {
        // Use chain-specific endpoint for better reliability
        url = `https://api.masterdex.xyz/v1/pairs/getbigSwaps/${chain}`;
      } else {
        // Use multi-chain endpoint when no specific chain is requested
        url = 'https://api.masterdex.xyz/v1/pairs/getbigSwaps';
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`MasterDex API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      let results: MasterDexTrade[] = data.data;

      // If using multi-chain endpoint, filter by chain if specified
      if (!chain && url === 'https://api.masterdex.xyz/v1/pairs/getbigSwaps') {
        // This case shouldn't happen since we're using chain-specific endpoint when chain is specified
        // But keeping it for safety
      }

      // Filter by token symbol (case-insensitive, substring match, matches either symbol0 or symbol1)
      if (token) {
        const tokenLower = token.toLowerCase();
        results = results.filter((trade: MasterDexTrade) =>
          (trade.symbol0 && trade.symbol0.toLowerCase().includes(tokenLower)) ||
          (trade.symbol1 && trade.symbol1.toLowerCase().includes(tokenLower))
        );
      }

      // Filter by pair (case-insensitive, matches either order)
      if (pair) {
        const [a, b] = pair.toLowerCase().split('/');
        results = results.filter((trade: MasterDexTrade) => {
          const s0 = trade.symbol0?.toLowerCase();
          const s1 = trade.symbol1?.toLowerCase();
          return (s0 === a && s1 === b) || (s0 === b && s1 === a);
        });
      }

      // Filter by minimum value
      if (minValue) {
        results = results.filter((trade: MasterDexTrade) => trade.tnxvalue >= minValue);
      }

      // Sort by time descending (latest first)
      results = results.sort((a: MasterDexTrade, b: MasterDexTrade) => new Date(b.time).getTime() - new Date(a.time).getTime());

      // Limit results
      if (limit && limit > 0) {
        results = results.slice(0, limit);
      }

      // Group results by chain for better organization
      const resultsByChain = results.reduce((acc, trade) => {
        const chainName = trade.chain || chain || 'unknown';
        if (!acc[chainName]) {
          acc[chainName] = [];
        }
        acc[chainName].push(trade);
        return acc;
      }, {} as Record<string, MasterDexTrade[]>);

      return {
        success: true,
        data: results,
        dataByChain: resultsByChain,
        count: results.length,
        message: data.message,
        source: 'MasterDex',
        url: url,
        supportedChains: ['ethereum', 'base', 'optimism', 'polygon', 'arbitrum', 'bnb', 'blast'],
        filteredChain: chain || 'all',
        endpointUsed: chain ? `chain-specific (${chain})` : 'multi-chain',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        url: chain ? `https://api.masterdex.xyz/v1/pairs/getbigSwaps/${chain}` : 'https://api.masterdex.xyz/v1/pairs/getbigSwaps',
      };
    }
  },
}); 