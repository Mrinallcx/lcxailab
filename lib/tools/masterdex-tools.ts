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

// Helper function to fetch with retry logic
async function fetchWithRetry(url: string, maxRetries: number = 3, delay: number = 1000): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'LCX-AI-Lab/1.0',
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      // If response is not ok, throw error to trigger retry
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isConnectionError = error instanceof Error && (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('fetch') ||
        error.name === 'AbortError'
      );
      
      if (isLastAttempt) {
        throw new Error(`Failed after ${maxRetries} attempts. Last error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      if (isConnectionError) {
        console.log(`Attempt ${attempt} failed with connection error, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        // Non-connection errors don't need retry
        throw error;
      }
    }
  }
  
  throw new Error('Unexpected error in fetchWithRetry');
}

// Helper function to format trade data for better readability
function formatTradeData(trade: MasterDexTrade) {
  return {
    // Basic trade info
    pair: `${trade.symbol0}/${trade.symbol1}`,
    type: trade.transType, // Buy/Sell
    value: `$${trade.tnxvalue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    
    // Token amounts
    amountBase: trade.amountBase,
    amountQuote: trade.amountQuote,
    
    // Price information
    price: trade.price,
    token0Price: trade.token0Price,
    token1Price: trade.token1Price,
    
    // Transaction details
    account: trade.account,
    transactionHash: trade.txnDetail,
    blockNumber: trade.blockNumber,
    
    // Time and chain
    time: new Date(trade.time).toLocaleString(),
    age: getTimeAgo(trade.time),
    chain: trade.chain,
    
    // Additional info
    isBotTrade: trade.bottrade,
    pairId: trade.pairId,
    feeTier: trade.feeTier,
    
    // Raw data for advanced use
    raw: trade
  };
}

// Helper function to calculate time ago
function getTimeAgo(timeString: string): string {
  const now = new Date();
  const time = new Date(timeString);
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// Helper function to get unique symbols from data
function getUniqueSymbols(trades: MasterDexTrade[]): string[] {
  const symbols = new Set<string>();
  trades.forEach(trade => {
    if (trade.symbol0) symbols.add(trade.symbol0);
    if (trade.symbol1) symbols.add(trade.symbol1);
  });
  return Array.from(symbols).sort();
}

// Helper function to search for token across all chains
async function searchTokenAcrossChains(token: string, limit: number = 20): Promise<{ results: MasterDexTrade[], chainsChecked: string[] }> {
  const supportedChains = ['ethereum', 'base', 'optimism', 'polygon', 'arbitrum', 'bnb', 'blast'];
  const allResults: MasterDexTrade[] = [];
  const chainsChecked: string[] = [];
  
  console.log(`🔍 Searching for "${token}" across all chains...`);
  
  for (const chain of supportedChains) {
    try {
      const url = `https://api.masterdex.xyz/v1/pairs/getbigSwaps/${chain}`;
      console.log(`  Checking ${chain}...`);
      
      const response = await fetchWithRetry(url);
      const data = await response.json();
      
      if (data && data.data && Array.isArray(data.data)) {
        const tokenLower = token.toLowerCase().trim();
        const chainResults = data.data.filter((trade: MasterDexTrade) => {
          const symbol0Lower = trade.symbol0?.toLowerCase() || '';
          const symbol1Lower = trade.symbol1?.toLowerCase() || '';
          return symbol0Lower.includes(tokenLower) || symbol1Lower.includes(tokenLower);
        });
        
        if (chainResults.length > 0) {
          console.log(`    ✅ Found ${chainResults.length} trades on ${chain}`);
          allResults.push(...chainResults);
        } else {
          console.log(`    ❌ No trades found on ${chain}`);
        }
      }
      
      chainsChecked.push(chain);
      
    } catch (error) {
      console.log(`    ⚠️ Error checking ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      chainsChecked.push(chain);
    }
  }
  
  console.log(`🔍 Total trades found across all chains: ${allResults.length}`);
  return { results: allResults, chainsChecked };
}

export const masterdexBigSwapsTool = tool({
  description: 'Fetch big swaps (large trades) happening on multiple blockchains from MasterDex. Supports Ethereum, Base, Optimism, Polygon, Arbitrum, BNB, and Blast. Returns detailed information including pair name, trade type (buy/sell), price, value, amounts, wallet address, transaction hash, and more.',
  parameters: z.object({
    chain: z.enum(['ethereum', 'base', 'optimism', 'polygon', 'arbitrum', 'bnb', 'blast']).optional().describe('Blockchain to fetch data from. If not specified, returns data from all supported chains.'),
    token: z.string().optional().describe('Token symbol to filter for (case-insensitive, matches either side of the pair)'),
    pair: z.string().optional().describe('Pair symbol to filter for, e.g., USDC/WETH (case-insensitive, any order)'),
    minValue: z.number().optional().describe('Minimum transaction value in USD'),
    limit: z.number().optional().describe('Maximum number of results to return (default: 20)'),
    tradeType: z.enum(['buy', 'sell']).optional().describe('Filter by trade type: buy or sell'),
  }),
  execute: async ({ chain, token, pair, minValue, limit = 20, tradeType }: { chain?: string; token?: string; pair?: string; minValue?: number; limit?: number; tradeType?: string }) => {
    try {
      console.log(`🔍 Starting MasterDex search...`);
      console.log(`📋 Filters: chain=${chain || 'all'}, token=${token || 'none'}, pair=${pair || 'none'}, minValue=${minValue || 'none'}, tradeType=${tradeType || 'all'}`);
      
      let results: MasterDexTrade[] = [];
      let url: string;
      let chainsChecked: string[] = [];
      
      // Smart chain selection logic
      if (chain) {
        // Use specific chain endpoint
        url = `https://api.masterdex.xyz/v1/pairs/getbigSwaps/${chain}`;
        console.log(`🔍 Using specific chain: ${chain}`);
        
        const response = await fetchWithRetry(url);
        const data = await response.json();
        
        if (!data || !data.data || !Array.isArray(data.data)) {
          throw new Error('Invalid response format from MasterDex API');
        }
        
        results = data.data;
        chainsChecked = [chain];
        
      } else if (token && !pair) {
        // If token is specified but no chain, search across all chains
        console.log(`🔍 Token specified without chain - searching across all chains for "${token}"`);
        const searchResult = await searchTokenAcrossChains(token, limit);
        results = searchResult.results;
        chainsChecked = searchResult.chainsChecked;
        url = 'multi-chain-search';
        
      } else {
        // Use multi-chain endpoint for general searches
        url = 'https://api.masterdex.xyz/v1/pairs/getbigSwaps';
        console.log(`🔍 Using multi-chain endpoint`);
        
        const response = await fetchWithRetry(url);
        const data = await response.json();
        
        if (!data || !data.data || !Array.isArray(data.data)) {
          throw new Error('Invalid response format from MasterDex API');
        }
        
        results = data.data;
        chainsChecked = ['multi-chain'];
      }
      
      console.log(`📊 Total trades fetched: ${results.length}`);

      // Get available symbols for debugging
      const availableSymbols = getUniqueSymbols(results);
      console.log(`🏷️ Available symbols: ${availableSymbols.slice(0, 10).join(', ')}${availableSymbols.length > 10 ? '...' : ''}`);

      // Filter by token symbol (case-insensitive, exact or substring match)
      if (token && chain) { // Only filter if we're using a specific chain or multi-chain endpoint
        const tokenLower = token.toLowerCase().trim();
        const originalCount = results.length;
        results = results.filter((trade: MasterDexTrade) => {
          const symbol0Lower = trade.symbol0?.toLowerCase() || '';
          const symbol1Lower = trade.symbol1?.toLowerCase() || '';
          const matches = symbol0Lower.includes(tokenLower) || symbol1Lower.includes(tokenLower);
          return matches;
        });
        console.log(`🔍 After token filter (${token}): ${results.length} trades (filtered out ${originalCount - results.length})`);
        
        if (results.length === 0) {
          console.log(`⚠️ No trades found for token "${token}". Available symbols: ${availableSymbols.join(', ')}`);
        }
      }

      // Filter by pair (case-insensitive, matches either order)
      if (pair) {
        const pairLower = pair.toLowerCase().trim();
        const [a, b] = pairLower.split('/');
        const originalCount = results.length;
        results = results.filter((trade: MasterDexTrade) => {
          const s0 = trade.symbol0?.toLowerCase() || '';
          const s1 = trade.symbol1?.toLowerCase() || '';
          const pairMatch = (s0 === a && s1 === b) || (s0 === b && s1 === a);
          return pairMatch;
        });
        console.log(`🔍 After pair filter (${pair}): ${results.length} trades (filtered out ${originalCount - results.length})`);
        
        if (results.length === 0) {
          console.log(`⚠️ No trades found for pair "${pair}". Available pairs: ${availableSymbols.slice(0, 5).join('/')}, etc.`);
        }
      }

      // Filter by trade type
      if (tradeType) {
        const tradeTypeLower = tradeType.toLowerCase();
        const originalCount = results.length;
        results = results.filter((trade: MasterDexTrade) => 
          trade.transType.toLowerCase() === tradeTypeLower
        );
        console.log(`🔍 After trade type filter (${tradeType}): ${results.length} trades (filtered out ${originalCount - results.length})`);
      }

      // Filter by minimum value
      if (minValue) {
        const originalCount = results.length;
        results = results.filter((trade: MasterDexTrade) => trade.tnxvalue >= minValue);
        console.log(`🔍 After min value filter ($${minValue}): ${results.length} trades (filtered out ${originalCount - results.length})`);
      }

      // Sort by time descending (latest first)
      results = results.sort((a: MasterDexTrade, b: MasterDexTrade) => new Date(b.time).getTime() - new Date(a.time).getTime());

      // Limit results
      if (limit && limit > 0) {
        results = results.slice(0, limit);
      }

      // Format the results for better readability
      const formattedResults = results.map(formatTradeData);

      // Group results by chain for better organization
      const resultsByChain = results.reduce((acc, trade) => {
        const chainName = trade.chain || chain || 'unknown';
        if (!acc[chainName]) {
          acc[chainName] = [];
        }
        acc[chainName].push(formatTradeData(trade));
        return acc;
      }, {} as Record<string, any[]>);

      const responseData = {
        success: true,
        data: formattedResults,
        dataByChain: resultsByChain,
        count: results.length,
        totalFetched: results.length,
        message: results.length > 0 
          ? `Found ${results.length} trades matching your criteria`
          : `No trades found matching your criteria. Available symbols: ${availableSymbols.slice(0, 10).join(', ')}`,
        source: 'MasterDex',
        url: url,
        supportedChains: ['ethereum', 'base', 'optimism', 'polygon', 'arbitrum', 'bnb', 'blast'],
        filteredChain: chain || 'all',
        endpointUsed: chain ? `chain-specific (${chain})` : url === 'multi-chain-search' ? 'cross-chain-search' : 'multi-chain',
        chainsChecked: chainsChecked,
        filters: {
          chain: chain || 'all',
          token: token || 'none',
          pair: pair || 'none',
          minValue: minValue || 'none',
          tradeType: tradeType || 'all',
          limit
        },
        availableSymbols: availableSymbols.slice(0, 20), // Show first 20 symbols for reference
        timestamp: new Date().toISOString(),
      };

      console.log(`✅ Tool execution completed. Returning ${results.length} trades.`);
      return responseData;

    } catch (error) {
      console.error('❌ MasterDex API error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        url: chain ? `https://api.masterdex.xyz/v1/pairs/getbigSwaps/${chain}` : 'https://api.masterdex.xyz/v1/pairs/getbigSwaps',
        timestamp: new Date().toISOString(),
        suggestion: 'Please try again in a few moments. If the issue persists, the MasterDex API might be temporarily unavailable.',
      };
    }
  },
}); 