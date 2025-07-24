import { tool } from 'ai';
import { z } from 'zod';

interface MasterDexTrade {
  symbol0?: string;
  symbol1?: string;
  tnxvalue: number;
  time: string;
  // ...other fields as needed
}

export const masterdexBigSwapsTool = tool({
  description: 'Fetch big swaps (large trades) happening on Base from MasterDex. Optionally filter by token symbol, pair, and minimum value.',
  parameters: z.object({
    token: z.string().optional().describe('Token symbol to filter for (case-insensitive, substring match, matches either side of the pair)'),
    pair: z.string().optional().describe('Pair symbol to filter for, e.g., VIRTUAL/WETH (case-insensitive, any order)'),
    minValue: z.number().optional().describe('Minimum transaction value in USD'),
    limit: z.number().optional().describe('Maximum number of results to return'),
  }),
  execute: async ({ token, pair, minValue, limit }: { token?: string; pair?: string; minValue?: number; limit?: number }) => {
    try {
      const response = await fetch('https://api.masterdex.xyz/v1/pairs/getbigSwaps/base');
      if (!response.ok) {
        throw new Error(`MasterDex API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      let results: MasterDexTrade[] = data.data;

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

      return {
        success: true,
        data: results,
        count: results.length,
        message: data.message,
        source: 'MasterDex',
        url: 'https://api.masterdex.xyz/v1/pairs/getbigSwaps/base',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
}); 