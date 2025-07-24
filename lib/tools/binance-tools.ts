import { tool } from 'ai';
import { z } from 'zod';
import { serverEnv } from '@/env/server';

// Helper for Binance API calls
async function binanceApiCall(endpoint: string, params?: Record<string, any>) {
  const url = new URL(`https://api.binance.com${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });
  }
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (serverEnv.BINANCE_API_KEY) {
    headers['X-MBX-APIKEY'] = serverEnv.BINANCE_API_KEY;
  }
  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// 1. Ticker Price Tool
export const binanceTickerTool = tool({
  description: 'Get the latest ticker price for a symbol from Binance.',
  parameters: z.object({
    symbol: z.string().describe('Trading symbol, e.g., BTCUSDT, ETHUSDT'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    try {
      const data = await binanceApiCall('/api/v3/ticker/price', { symbol });
      return {
        success: true,
        symbol,
        price: data.price,
        source: 'Binance',
        url: `https://www.binance.com/en/trade/${symbol}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol,
      };
    }
  },
});

// 2. Candlestick (OHLCV) Tool
export const binanceKlinesTool = tool({
  description: 'Get candlestick (OHLCV) data for a symbol from Binance.',
  parameters: z.object({
    symbol: z.string().describe('Trading symbol, e.g., BTCUSDT, ETHUSDT'),
    interval: z.string().default('1d').describe('Kline interval (e.g., 1m, 5m, 1h, 1d)'),
    limit: z.number().default(30).describe('Number of klines to fetch (default: 30, max: 1000)'),
  }),
  execute: async ({ symbol, interval = '1d', limit = 30 }: { symbol: string; interval?: string; limit?: number }) => {
    try {
      const data = await binanceApiCall('/api/v3/klines', { symbol, interval, limit });
      const formatted = data.map((k: any[]) => ({
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        closeTime: k[6],
      }));
      return {
        success: true,
        symbol,
        interval,
        klines: formatted,
        source: 'Binance',
        url: `https://www.binance.com/en/trade/${symbol}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol,
        interval,
      };
    }
  },
});

// 3. Order Book Tool
export const binanceOrderBookTool = tool({
  description: 'Get the order book (bids and asks) for a symbol from Binance.',
  parameters: z.object({
    symbol: z.string().describe('Trading symbol, e.g., BTCUSDT, ETHUSDT'),
    limit: z.number().default(100).describe('Limit the number of bids and asks (5, 10, 20, 50, 100, 500, 1000, 5000)'),
  }),
  execute: async ({ symbol, limit = 100 }: { symbol: string; limit?: number }) => {
    try {
      const data = await binanceApiCall('/api/v3/depth', { symbol, limit });
      return {
        success: true,
        symbol,
        lastUpdateId: data.lastUpdateId,
        bids: data.bids,
        asks: data.asks,
        source: 'Binance',
        url: `https://www.binance.com/en/trade/${symbol}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol,
      };
    }
  },
});

// 4. Recent Trades Tool
export const binanceRecentTradesTool = tool({
  description: 'Get recent trades for a symbol from Binance.',
  parameters: z.object({
    symbol: z.string().describe('Trading symbol, e.g., BTCUSDT, ETHUSDT'),
    limit: z.number().default(50).describe('Number of trades to fetch (default: 50, max: 1000)'),
  }),
  execute: async ({ symbol, limit = 50 }: { symbol: string; limit?: number }) => {
    try {
      const data = await binanceApiCall('/api/v3/trades', { symbol, limit });
      return {
        success: true,
        symbol,
        trades: data,
        source: 'Binance',
        url: `https://www.binance.com/en/trade/${symbol}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol,
      };
    }
  },
});

// 5. Exchange Info Tool
export const binanceExchangeInfoTool = tool({
  description: 'Get exchange information and list of all trading pairs from Binance.',
  parameters: z.object({}),
  execute: async () => {
    try {
      const data = await binanceApiCall('/api/v3/exchangeInfo');
      return {
        success: true,
        symbols: data.symbols,
        timezone: data.timezone,
        serverTime: data.serverTime,
        rateLimits: data.rateLimits,
        exchangeFilters: data.exchangeFilters,
        source: 'Binance',
        url: 'https://www.binance.com/en/markets',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
}); 