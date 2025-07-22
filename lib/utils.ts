// /lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Globe, Book, TelescopeIcon, DollarSign } from 'lucide-react'
import { ChatsCircleIcon, CodeIcon, MemoryIcon, RedditLogoIcon, YoutubeLogoIcon, XLogoIcon } from '@phosphor-icons/react'
import React from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type SearchGroupId = 'web' | 'x' | 'academic' | 'youtube' | 'reddit' | 'analysis' | 'chat' | 'memory' | 'crypto' | 'lcx';

// Custom icon for LCX Exchange
const LCXToolIcon = (props: any) => React.createElement('img', { src: '/toolicon.svg', alt: 'LCX Exchange', className: 'h-7 w-7', style: { width: 24, height: 24, ...(props.style || {}) }, ...props });
// Custom icon for CoinGecko (Crypto)
const CoinGeckoIcon = (props: any) => React.createElement('img', { src: '/coingecko.svg', alt: 'CoinGecko', className: 'h-7 w-7', style: { width: 22, height: 22, ...(props.style || {}) }, ...props });
// Custom icon for Yahoo (Analysis)
const YahooIcon = (props: any) => React.createElement('img', { src: '/yahoo.svg', alt: 'Yahoo', className: 'h-7 w-7', style: { width: 20, height: 20, ...(props.style || {}) }, ...props });

export const searchGroups = [
  // Web, X & Reddit
  {
    id: 'web' as const,
    name: 'Internet',
    description: 'Search across internet',
    icon: Globe,
    show: true,
    category: 'Search content',
  },
  {
    id: 'x' as const,
    name: 'X',
    description: 'Search X posts',
    icon: XLogoIcon,
    show: true,
    category: 'Search content',
  },
  {
    id: 'reddit' as const,
    name: 'Reddit',
    description: 'Search Reddit posts',
    icon: RedditLogoIcon,
    show: true,
    category: 'Search content',
  },
  // Crypto & Finance
  {
    id: 'coingecko' as const,
    name: 'Coingecko',
    description: 'Cryptocurrency research',
    icon: CoinGeckoIcon,
    show: true,
    category: 'Crypto & Finance',
  },
  {
    id: 'lcx' as const,
    name: 'LCX Exchange',
    description: 'Real time trading data',
    icon: LCXToolIcon,
    show: true,
    category: 'Crypto & Finance',
  },
  {
    id: 'analysis' as const,
    name: 'Finance & Stocks',
    description: 'Powered by Yahoo Finance',
    icon: YahooIcon,
    show: true,
    category: 'Crypto & Finance',
  },
  // The rest (hidden or not shown)
  {
    id: 'memory' as const,
    name: 'Memory',
    description: 'Your personal memory companion',
    icon: MemoryIcon,
    show: true,
    requireAuth: true,
    category: 'Crypto & Finance',
  },
  {
    id: 'academic' as const,
    name: 'Academic',
    description: 'Search academic papers powered by Exa',
    icon: Book,
    show: false,
    category: 'Crypto & Finance',
  },
  {
    id: 'youtube' as const,
    name: 'YouTube',
    description: 'Search YouTube videos powered by Exa',
    icon: YoutubeLogoIcon,
    show: false,
    category: 'Crypto & Finance',
  },
  {
    id: 'extreme' as const,
    name: 'Extreme',
    description: 'Deep research with multiple sources and analysis',
    icon: TelescopeIcon,
    show: false,
    category: 'Crypto & Finance',
  },
  {
    id: 'chat' as const,
    name: 'Chat',
    description: 'Talk to the model directly.',
    icon: ChatsCircleIcon,
    show: false,
    category: 'Crypto & Finance',
  },
] as const;

export type SearchGroup = typeof searchGroups[number];

export function invalidateChatsCache() {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('invalidate-chats-cache');
    window.dispatchEvent(event);
  }
}