import { tool } from 'ai';
import { z } from 'zod';

// LCX API Configuration
const LCX_BASE_URL = 'https://exchange-api.lcx.com';
const LCX_KLINE_URL = 'https://api-kline.lcx.com/v1/market/kline';
const LCX_WS_URL = 'wss://exchange-api.lcx.com';

// Helper function for LCX API calls
async function lcxApiCall(endpoint: string, params?: Record<string, any>) {
  const url = new URL(`${LCX_BASE_URL}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'API-VERSION': '1.1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`LCX API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// 1. Kline (Candlestick) Data Tool
export const lcxKlineTool = tool({
  description: 'Get OHLCV (Open, High, Low, Close, Volume) candlestick data from LCX exchange for charting.',
  parameters: z.object({
    pair: z.string().describe('Trading pair (e.g., LCX/ETH, BTC/EUR, MATIC/EUR)'),
    resolution: z.string().optional().describe('Time resolution (1, 3, 5, 15, 30, 45, 60, 120, 180, 240, 1D, 1W, 1M) - default: 1D'),
    from: z.number().optional().describe('Start timestamp in seconds'),
    to: z.number().optional().describe('End timestamp in seconds'),
  }),
  execute: async ({
    pair,
    resolution = '1D',
    from,
    to,
  }: {
    pair: string;
    resolution?: string;
    from?: number;
    to?: number;
  }) => {
    console.log('Fetching LCX kline data for:', pair, 'resolution:', resolution);

    try {
      // Convert pair format from BTC/EUR to BTC-EUR
      const formattedPair = pair.replace('/', '-');
      
      // Set default time range if not provided (last 30 days)
      const now = Math.floor(Date.now() / 1000);
      const defaultFrom = from || (now - (30 * 24 * 60 * 60)); // 30 days ago
      const defaultTo = to || now;
      
      const params: Record<string, any> = { 
        pair: formattedPair, 
        resolution,
        from: defaultFrom,
        to: defaultTo
      };

      // Use the dedicated kline API endpoint
      const url = new URL(LCX_KLINE_URL);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value.toString());
        }
      });

      console.log('LCX Kline API URL:', url.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log('LCX Kline API Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LCX Kline API Error Response:', errorText);
        throw new Error(`LCX Kline API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('LCX Kline API Response Data:', JSON.stringify(data, null, 2));

      // Handle different possible response structures
      const klineData = data.data || data;
      
      if (!klineData || !Array.isArray(klineData) || klineData.length === 0) {
        return {
          success: false,
          error: 'No kline data available for this pair and time range',
          pair,
          resolution,
          suggestion: `Try using lcx_ticker for current price data instead. The LCX kline API may have limited historical data availability.`,
          alternative: 'Use lcx_ticker tool for current price information',
        };
      }

      // Format the data for chart display based on actual API response
      const formattedData = klineData.map((candle: any) => {
        // Handle different candle formats
        const timestamp = candle.timestamp || candle.time || candle.date;
        const open = candle.open || candle.o;
        const high = candle.high || candle.h;
        const low = candle.low || candle.l;
        const close = candle.close || candle.c;
        const volume = candle.volume || candle.v;

        return {
          timestamp: timestamp * 1000, // Convert to milliseconds
          date: new Date(timestamp * 1000).toISOString(),
          open,
          high,
          low,
          close,
          volume,
        };
      });

      return {
        success: true,
        pair,
        resolution,
        chart: {
          title: `${pair} Price Chart (${resolution})`,
          type: 'candlestick',
          data: formattedData,
          elements: formattedData,
          x_scale: 'datetime',
          y_scale: 'linear',
          x_label: 'Time',
          y_label: 'Price',
        },
        source: 'LCX Exchange',
        url: `https://exchange.lcx.com/trading/${pair}`,
        dataPoints: formattedData.length,
      };
    } catch (error) {
      console.error('LCX kline error:', error);
      
      // Try to get available pairs to suggest alternatives
      try {
        const pairsData = await lcxApiCall('/api/pairs');
        const availablePairs = pairsData.data || [];
        const similarPairs = availablePairs
          .filter((p: any) => p.pair && p.pair.includes(pair.split('/')[0]))
          .slice(0, 5)
          .map((p: any) => p.pair);
        
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          pair,
          resolution,
          suggestion: `Pair ${pair} not found. Available similar pairs: ${similarPairs.join(', ')}`,
          availablePairs: similarPairs,
        };
      } catch (pairsError) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          pair,
          resolution,
          suggestion: 'Unable to fetch available pairs for suggestions',
        };
      }
    }
  },
});

// 2. Order Book Data Tool
export const lcxOrderBookTool = tool({
  description: 'Get complete order book data for a trading pair on LCX exchange.',
  parameters: z.object({
    pair: z.string().describe('Trading pair (e.g., LCX/ETH, BTC/EUR, MATIC/EUR)'),
  }),
  execute: async ({ pair }: { pair: string }) => {
    console.log('Fetching LCX order book for:', pair);

    try {
      const data = await lcxApiCall('/api/book', { pair });

      // Format order book data based on actual API response
      const formattedBids = data.data.buy.map((order: any) => ({
        price: order[0],
        amount: order[1],
        total: order[0] * order[1],
      }));

      const formattedAsks = data.data.sell.map((order: any) => ({
        price: order[0],
        amount: order[1],
        total: order[0] * order[1],
      }));

      // Calculate market depth
      const bidDepth = formattedBids.reduce((sum: number, order: any) => sum + order.amount, 0);
      const askDepth = formattedAsks.reduce((sum: number, order: any) => sum + order.amount, 0);

      // Calculate spread
      const bestBid = formattedBids[0]?.price || 0;
      const bestAsk = formattedAsks[0]?.price || 0;
      const spread = bestAsk - bestBid;
      const spreadPercentage = bestBid > 0 ? (spread / bestBid) * 100 : 0;

      return {
        success: true,
        pair,
        orderBook: {
          bids: formattedBids,
          asks: formattedAsks,
          bidDepth,
          askDepth,
          spread,
          spreadPercentage,
          bestBid,
          bestAsk,
        },
        source: 'LCX Exchange',
        url: `https://exchange.lcx.com/trading/${pair}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('LCX order book error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        pair,
      };
    }
  },
});

// 3. Ticker Data Tool
export const lcxTickerTool = tool({
  description: 'Get real-time ticker data for a specific trading pair on LCX exchange.',
  parameters: z.object({
    pair: z.string().describe('Trading pair (e.g., LCX/ETH, BTC/EUR, MATIC/EUR)'),
  }),
  execute: async ({ pair }: { pair: string }) => {
    console.log('Fetching LCX ticker for:', pair);

    try {
      const data = await lcxApiCall('/api/ticker', { pair });
      
      // Debug: Log the actual response structure
      console.log('LCX Ticker API Response:', JSON.stringify(data, null, 2));

      // Handle different possible response structures
      const tickerData = data.data || data;
      
      return {
        success: true,
        pair,
        ticker: {
          lastPrice: tickerData.last || tickerData.lastPrice || tickerData.price || tickerData.close,
          bid: tickerData.bid || tickerData.buy,
          ask: tickerData.ask || tickerData.sell,
          high: tickerData.high || tickerData.highest,
          low: tickerData.low || tickerData.lowest,
          volume: tickerData.volume || tickerData.vol,
          change: tickerData.change || tickerData.priceChange,
          changePercent: tickerData.changePercent || tickerData.priceChangePercent || tickerData.change24h,
          timestamp: new Date().toISOString(),
        },
        source: 'LCX Exchange',
        url: `https://exchange.lcx.com/trading/${pair}`,
      };
    } catch (error) {
      console.error('LCX ticker error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        pair,
      };
    }
  },
});

// 4. All Pairs Tool
export const lcxPairsTool = tool({
  description: 'Get all available trading pairs on LCX exchange.',
  parameters: z.object({}),
  execute: async () => {
    console.log('Fetching LCX trading pairs');

    try {
      const data = await lcxApiCall('/api/pairs');

      // Group pairs by base currency based on actual API response
      const pairsByBase = data.data.reduce((acc: Record<string, any[]>, pair: any) => {
        const base = pair.base;
        if (!acc[base]) {
          acc[base] = [];
        }
        acc[base].push({
          pair: pair.pair,
          base: pair.base,
          quote: pair.quote,
          status: pair.status,
        });
        return acc;
      }, {});

      return {
        success: true,
        pairs: data.data,
        pairsByBase,
        totalPairs: data.data.length,
        source: 'LCX Exchange',
        url: 'https://exchange.lcx.com/trading',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('LCX pairs error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});

// 4.5. Specific Pair Tool
export const lcxPairTool = tool({
  description: 'Get detailed information about a specific trading pair on LCX exchange.',
  parameters: z.object({
    pair: z.string().describe('Trading pair (e.g., LCX/ETH, BTC/EUR, MATIC/EUR)'),
  }),
  execute: async ({ pair }: { pair: string }) => {
    console.log('Fetching LCX pair details for:', pair);

    try {
      const data = await lcxApiCall('/api/pair', { pair });

      return {
        success: true,
        pair,
        pairInfo: data.data,
        source: 'LCX Exchange',
        url: `https://exchange.lcx.com/trading/${pair}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('LCX pair error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        pair,
      };
    }
  },
});

// 5. All Tickers Tool
export const lcxTickersTool = tool({
  description: 'Get all ticker data for all trading pairs on LCX exchange.',
  parameters: z.object({}),
  execute: async () => {
    console.log('Fetching LCX all tickers');

    try {
      const data = await lcxApiCall('/api/tickers');

      return {
        success: true,
        tickers: data.data,
        totalTickers: data.data.length,
        source: 'LCX Exchange',
        url: 'https://exchange.lcx.com/trading',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('LCX tickers error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});

// 6. Recent Trades Tool
export const lcxTradesTool = tool({
  description: 'Get recent trades for a trading pair on LCX exchange.',
  parameters: z.object({
    pair: z.string().describe('Trading pair (e.g., LCX/ETH, BTC/EUR, MATIC/EUR)'),
    limit: z.number().optional().describe('Number of trades to fetch (default: 100, max: 1000)'),
  }),
  execute: async ({ pair, limit = 100 }: { pair: string; limit?: number }) => {
    console.log('Fetching LCX recent trades for:', pair, 'limit:', limit);

    try {
      const data = await lcxApiCall('/api/trades', { pair, limit });

      // Format trade data based on actual API response
      const formattedTrades = data.data.map((trade: any) => ({
        id: trade.id,
        price: trade.price,
        amount: trade.amount,
        side: trade.side, // BUY or SELL
        timestamp: trade.timestamp,
        date: new Date(trade.timestamp * 1000).toISOString(),
        total: trade.price * trade.amount,
      }));

      // Calculate trade statistics
      const totalVolume = formattedTrades.reduce((sum: number, trade: any) => sum + trade.amount, 0);
      const avgPrice = formattedTrades.reduce((sum: number, trade: any) => sum + trade.total, 0) / totalVolume;
      const buyTrades = formattedTrades.filter((trade: any) => trade.side === 'BUY');
      const sellTrades = formattedTrades.filter((trade: any) => trade.side === 'SELL');

      return {
        success: true,
        pair,
        trades: formattedTrades,
        statistics: {
          totalTrades: formattedTrades.length,
          totalVolume,
          averagePrice: avgPrice,
          buyTrades: buyTrades.length,
          sellTrades: sellTrades.length,
          buyVolume: buyTrades.reduce((sum: number, trade: any) => sum + trade.amount, 0),
          sellVolume: sellTrades.reduce((sum: number, trade: any) => sum + trade.amount, 0),
        },
        source: 'LCX Exchange',
        url: `https://exchange.lcx.com/trading/${pair}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('LCX trades error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        pair,
      };
    }
  },
}); 