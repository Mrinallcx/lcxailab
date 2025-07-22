'use client';

import { clientEnv } from '@/env/client';
import { ThemeProvider } from 'next-themes';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { ReactNode } from 'react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@radix-ui/react-tooltip';

if (typeof window !== 'undefined' && clientEnv.NEXT_PUBLIC_POSTHOG_KEY && clientEnv.NEXT_PUBLIC_POSTHOG_HOST) {
  console.log('🔍 Initializing PostHog with:', {
    key: clientEnv.NEXT_PUBLIC_POSTHOG_KEY?.substring(0, 10) + '...',
    host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST
  });
  
  posthog.init(clientEnv.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'always',
    loaded: (posthog) => {
      console.log('✅ PostHog loaded successfully');
      // Send a test event
      posthog.capture('app_loaded', { source: 'providers' });
    },
    capture_pageview: true,
    capture_pageleave: true,
  });
  
  // Send a test event after initialization
  setTimeout(() => {
    if (posthog.isFeatureEnabled('test')) {
      console.log('✅ PostHog feature flags working');
    }
    posthog.capture('page_view', { page: window.location.pathname });
  }, 1000);
} else {
  console.log('⚠️ PostHog not initialized - missing environment variables');
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const isPostHogEnabled = typeof window !== 'undefined' && clientEnv.NEXT_PUBLIC_POSTHOG_KEY && clientEnv.NEXT_PUBLIC_POSTHOG_HOST;
  
  return (
    <QueryClientProvider client={queryClient}>
      {isPostHogEnabled ? (
      <PostHogProvider client={posthog}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </PostHogProvider>
      ) : (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      )}
    </QueryClientProvider>
  );
}
