"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        // Global SWR configuration for optimal caching
        revalidateOnFocus: false, // Don't refetch when window gains focus
        revalidateOnReconnect: true, // Refetch when reconnecting to network
        revalidateIfStale: false, // Don't auto-revalidate stale data
        dedupingInterval: 30000, // Dedupe requests within 30 seconds
        focusThrottleInterval: 60000, // Throttle focus revalidation to 1 minute
        keepPreviousData: true, // Keep previous data while fetching new
        errorRetryCount: 3, // Retry failed requests up to 3 times
        errorRetryInterval: 5000, // Wait 5 seconds between retries
        shouldRetryOnError: true,
        // Cache provider with better performance
        provider: () => new Map(),
        // Global fetcher if needed
        fetcher: async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) {
            const error = new Error('An error occurred while fetching the data.');
            throw error;
          }
          return res.json();
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
