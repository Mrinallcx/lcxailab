import { tool } from 'ai';
import { z } from 'zod';

// Price Prediction Tool
export const lcxPricePredictionTool = tool({
  description: 'Get future price predictions for cryptocurrency pairs using technical analysis and market data.',
  parameters: z.object({
    pair: z.string().describe('Trading pair (e.g., BTC/EUR, ETH/EUR)'),
    timeframe: z.string().optional().describe('Prediction timeframe (1h, 4h, 1d, 1w, 1m) - default: 1d'),
    method: z.string().optional().describe('Prediction method (technical, sentiment, ml) - default: technical'),
  }),
  execute: async ({
    pair,
    timeframe = '1d',
    method = 'technical',
  }: {
    pair: string;
    timeframe?: string;
    method?: string;
  }) => {
    console.log('Generating price prediction for:', pair, 'timeframe:', timeframe, 'method:', method);

    try {
      // 1. Get current market data from LCX
      const currentData = await getCurrentMarketData(pair);
      
      // 2. Generate prediction based on method
      let prediction;
      switch (method) {
        case 'technical':
          prediction = await generateTechnicalPrediction(currentData, timeframe);
          break;
        case 'sentiment':
          prediction = await generateSentimentPrediction(pair, timeframe);
          break;
        case 'ml':
          prediction = await generateMLPrediction(pair, timeframe);
          break;
        default:
          prediction = await generateTechnicalPrediction(currentData, timeframe);
      }

      return {
        success: true,
        pair,
        timeframe,
        method,
        currentPrice: currentData.lastPrice,
        prediction: {
          estimatedPrice: prediction.estimatedPrice,
          confidence: prediction.confidence,
          trend: prediction.trend,
          support: prediction.support,
          resistance: prediction.resistance,
          factors: prediction.factors,
        },
        disclaimer: 'This is a prediction based on technical analysis and should not be considered financial advice. Always do your own research.',
        source: 'LCX Exchange + Technical Analysis',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Price prediction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        pair,
        timeframe,
        method,
        suggestion: 'Try using lcx_ticker for current price data instead.',
      };
    }
  },
});

// Helper function to get current market data
async function getCurrentMarketData(pair: string) {
  const response = await fetch(`https://exchange-api.lcx.com/api/ticker?pair=${pair}`, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch market data: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data;
}

// Technical analysis prediction
async function generateTechnicalPrediction(marketData: any, timeframe: string) {
  const currentPrice = marketData.lastPrice;
  const change24h = marketData.change;
  const high24h = marketData.high;
  const low24h = marketData.low;
  const volume = marketData.volume;

  // Simple technical analysis based on current data
  const trend = change24h > 0 ? 'bullish' : 'bearish';
  const volatility = (high24h - low24h) / currentPrice;
  
  // Calculate estimated future price based on trend and volatility
  let estimatedPrice = currentPrice;
  let confidence = 0.5; // Base confidence
  
  if (trend === 'bullish') {
    estimatedPrice = currentPrice * (1 + (volatility * 0.1));
    confidence = 0.6;
  } else {
    estimatedPrice = currentPrice * (1 - (volatility * 0.1));
    confidence = 0.6;
  }

  // Adjust for timeframe
  const timeframeMultiplier = getTimeframeMultiplier(timeframe);
  estimatedPrice = currentPrice + (estimatedPrice - currentPrice) * timeframeMultiplier;

  return {
    estimatedPrice: Math.round(estimatedPrice * 100) / 100,
    confidence: Math.min(confidence, 0.8), // Cap confidence at 80%
    trend,
    support: Math.round(low24h * 0.98 * 100) / 100,
    resistance: Math.round(high24h * 1.02 * 100) / 100,
    factors: [
      `24h change: ${change24h}%`,
      `Volume: ${volume}`,
      `Volatility: ${(volatility * 100).toFixed(2)}%`,
      `Trend: ${trend}`,
    ],
  };
}

// Sentiment analysis prediction (placeholder)
async function generateSentimentPrediction(pair: string, timeframe: string) {
  // This would integrate with sentiment analysis APIs
  // For now, return a basic prediction
  return {
    estimatedPrice: 0,
    confidence: 0.3,
    trend: 'neutral',
    support: 0,
    resistance: 0,
    factors: ['Sentiment analysis not yet implemented'],
  };
}

// Machine learning prediction (placeholder)
async function generateMLPrediction(pair: string, timeframe: string) {
  // This would integrate with ML prediction APIs
  // For now, return a basic prediction
  return {
    estimatedPrice: 0,
    confidence: 0.4,
    trend: 'neutral',
    support: 0,
    resistance: 0,
    factors: ['ML prediction not yet implemented'],
  };
}

// Helper function to get timeframe multiplier
function getTimeframeMultiplier(timeframe: string): number {
  switch (timeframe) {
    case '1h': return 0.1;
    case '4h': return 0.3;
    case '1d': return 1;
    case '1w': return 3;
    case '1m': return 10;
    default: return 1;
  }
} 