import { tool } from 'ai';
import { z } from 'zod';
import { Daytona } from '@daytonaio/sdk';
import { tavily } from '@tavily/core';
import Exa from 'exa-js';
import { generateObject } from 'ai';
import { serverEnv } from '@/env/server';
import { scira } from '@/ai/providers';
import { SNAPSHOT_NAME } from '@/lib/constants';

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  RUB: '₽',
  KRW: '₩',
  BTC: '₿',
  THB: '฿',
  BRL: 'R$',
  PHP: '₱',
  ILS: '₪',
  TRY: '₺',
  NGN: '₦',
  VND: '₫',
  ARS: '$',
  ZAR: 'R',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  HKD: 'HK$',
  NZD: 'NZ$',
  MXN: 'Mex$',
} as const;

interface NewsResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  category: string;
  query: string;
}

interface NewsGroup {
  query: string;
  topic: string;
  results: NewsResult[];
}

export const stockChartTool = tool({
  description: 'Get stock data and news for given stock symbols.',
  parameters: z.object({
    title: z.string().describe('The title of the chart.'),
    news_queries: z.array(z.string()).describe('The news queries to search for.'),
    icon: z.enum(['stock', 'date', 'calculation', 'default']).describe('The icon to display for the chart.'),
    stock_symbols: z.array(z.string()).describe('The stock symbols to display for the chart.'),
    currency_symbols: z
      .array(z.string())
      .describe(
        'The currency symbols for each stock/asset in the chart. Available symbols: ' +
        Object.keys(CURRENCY_SYMBOLS).join(', ') +
        '. Defaults to USD if not provided.',
      ),
    interval: z
      .enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'])
      .describe('The interval of the chart. default is 1y.'),
  }),
  execute: async ({
    title,
    icon,
    stock_symbols,
    currency_symbols,
    interval,
    news_queries,
  }: {
    title: string;
    icon: string;
    stock_symbols: string[];
    currency_symbols?: string[];
    interval: string;
    news_queries: string[];
  }) => {
    console.log('Title:', title);
    console.log('Icon:', icon);
    console.log('Stock symbols:', stock_symbols);
    console.log('Currency symbols:', currency_symbols);
    console.log('Interval:', interval);
    console.log('News queries:', news_queries);

    const formattedCurrencySymbols = (currency_symbols || stock_symbols.map(() => 'USD')).map((currency) => {
      const symbol = CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS];
      return symbol || currency;
    });

    let news_results: NewsGroup[] = [];

    const tvly = tavily({ apiKey: serverEnv.TAVILY_API_KEY });

    const searchPromises = [];
    for (const query of news_queries) {
      searchPromises.push({
        query,
        topic: 'finance',
        promise: tvly.search(query, {
          topic: 'finance',
          days: 7,
          maxResults: 3,
          searchDepth: 'advanced',
        }),
      });

      searchPromises.push({
        query,
        topic: 'news',
        promise: tvly.search(query, {
          topic: 'news',
          days: 7,
          maxResults: 3,
          searchDepth: 'advanced',
        }),
      });
    }

    const searchResults = await Promise.all(
      searchPromises.map(({ promise }) =>
        promise.catch((err) => ({
          results: [],
          error: err.message,
        })),
      ),
    );

    const urlSet = new Set();
    searchPromises.forEach(({ query, topic }, index) => {
      const result = searchResults[index];
      if (!result.results) return;

      const processedResults = result.results
        .filter((item) => {
          if (urlSet.has(item.url)) return false;
          urlSet.add(item.url);
          return true;
        })
        .map((item) => ({
          title: item.title,
          url: item.url,
          content: item.content.slice(0, 30000),
          published_date: item.publishedDate,
          category: topic,
          query: query,
        }));

      if (processedResults.length > 0) {
        news_results.push({
          query,
          topic,
          results: processedResults,
        });
      }
    });

    const exaResults: NewsGroup[] = [];
    try {
      const exa = new Exa(serverEnv.EXA_API_KEY);
      const exaSearchPromises = stock_symbols.map((symbol) =>
        exa
          .searchAndContents(`${symbol} financial report analysis`, {
            text: true,
            category: 'financial report',
            livecrawl: 'always',
            type: 'auto',
            numResults: 10,
            summary: {
              query: 'all important information relevent to the important for investors',
            },
          })
          .catch((error: any) => {
            console.error(`Exa search error for ${symbol}:`, error);
            return { results: [] };
          }),
      );

      const exaSearchResults = await Promise.all(exaSearchPromises);

      const exaUrlSet = new Set();
      exaSearchResults.forEach((result: any, index: number) => {
        if (!result.results || result.results.length === 0) return;

        const stockSymbol = stock_symbols[index];
        const processedResults = result.results
          .filter((item: any) => {
            if (exaUrlSet.has(item.url)) return false;
            exaUrlSet.add(item.url);
            return true;
          })
          .map((item: any) => ({
            title: item.title || '',
            url: item.url,
            content: item.summary || '',
            published_date: item.publishedDate,
            category: 'financial',
            query: stockSymbol,
          }));

        if (processedResults.length > 0) {
          exaResults.push({
            query: stockSymbol,
            topic: 'financial',
            results: processedResults,
          });
        }
      });

      for (const group of exaResults) {
        for (let i = 0; i < group.results.length; i++) {
          const result = group.results[i];
          if (!result.title || result.title.trim() === '') {
            try {
              const { object } = await generateObject({
                model: scira.languageModel('scira-nano'),
                prompt: `Complete the following financial report with an appropriate title. The report is about ${group.query
                  } and contains this content: ${result.content.substring(0, 500)}...`,
                schema: z.object({
                  title: z.string().describe('A descriptive title for the financial report'),
                }),
              });
              group.results[i].title = object.title;
            } catch (error) {
              console.error(`Error generating title for ${group.query} report:`, error);
              group.results[i].title = `${group.query} Financial Report`;
            }
          }
        }
      }

      news_results = [...news_results, ...exaResults];
    } catch (error) {
      console.error('Error fetching Exa financial reports:', error);
    }

    const code = `
# Install yfinance if not available
import subprocess
import sys
import os

try:
    import yfinance
    print("✅ yfinance already available")
except ImportError:
    print("Installing yfinance...")
    # Use pip install with --user flag to avoid permission issues
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "yfinance"])
    # Add user site-packages to path
    import site
    user_site = site.getusersitepackages()
    if user_site not in sys.path:
        sys.path.insert(0, user_site)
    import yfinance
    print("✅ yfinance installed successfully")

import yfinance as yf
import pandas as pd
import json
from datetime import datetime

${stock_symbols
        .map(
          (symbol) =>
            `${symbol.toLowerCase().replace('.', '')} = yf.download('${symbol}', period='${interval}', interval='1d')`,
        )
        .join('\n')}

# Prepare chart data
chart_data = {
    "type": "line",
    "title": "${title}",
    "x_label": "Date",
    "y_label": "Closing Price (${formattedCurrencySymbols[0]})",
    "x_scale": "datetime",
    "elements": []
}

${stock_symbols
        .map(
          (symbol, index) => `
# Convert data for ${symbol}
${symbol.toLowerCase().replace('.', '')}_data = ${symbol.toLowerCase().replace('.', '')}.reset_index()
${symbol.toLowerCase().replace('.', '')}_data['Date'] = ${symbol.toLowerCase().replace('.', '')}_data['Date'].dt.strftime('%Y-%m-%d')
${symbol.toLowerCase().replace('.', '')}_points = ${symbol.toLowerCase().replace('.', '')}_data[['Date', 'Close']].values.tolist()

chart_data["elements"].append({
    "label": "${symbol} ${formattedCurrencySymbols[index]}",
    "points": ${symbol.toLowerCase().replace('.', '')}_points
})
`,
        )
        .join('\n')}

# Print the chart data as JSON
print("CHART_DATA_START")
print(json.dumps(chart_data))
print("CHART_DATA_END")

# Also print some basic stats
${stock_symbols
        .map(
          (symbol) => `
latest_close = ${symbol.toLowerCase().replace('.', '')}['Close'].iloc[-1]
high_52w = ${symbol.toLowerCase().replace('.', '')}['High'].max()
low_52w = ${symbol.toLowerCase().replace('.', '')}['Low'].min()
print(f"${symbol} - Latest Close: {latest_close:.2f}")
print(f"${symbol} - 52-week high: {high_52w:.2f}")
print(f"${symbol} - 52-week low: {low_52w:.2f}")
`,
        )
        .join('\n')}`;

    console.log('Code:', code);

    const daytona = new Daytona({
      apiKey: serverEnv.DAYTONA_API_KEY,
      target: 'us',
    });

    const sandbox = await daytona.create();

    const execution = await sandbox.process.codeRun(code);
    let message = '';

    if (execution.result === execution.artifacts?.stdout) {
      message += execution.result;
    } else if (execution.result && execution.result !== execution.artifacts?.stdout) {
      message += execution.result;
    } else if (execution.artifacts?.stdout && execution.artifacts?.stdout !== execution.result) {
      message += execution.artifacts.stdout;
    } else {
      message += execution.result;
    }

    console.log('execution exit code: ', execution.exitCode);
    console.log('execution result: ', execution.result);

    // Extract chart data from the output
    let chartData = undefined;
    if (execution.result && execution.result.includes('CHART_DATA_START')) {
      const chartMatch = execution.result.match(/CHART_DATA_START\s*(\{.*?\})\s*CHART_DATA_END/s);
      if (chartMatch) {
        try {
          chartData = JSON.parse(chartMatch[1]);
        } catch (error) {
          console.error('Error parsing chart data:', error);
        }
      }
    }

    console.log('Chart data extracted:', chartData ? 'Success' : 'Failed');

    await sandbox.delete();

    return {
      message: message.trim(),
      chart: chartData,
      currency_symbols: formattedCurrencySymbols,
      news_results: news_results,
    };
  },
}); 