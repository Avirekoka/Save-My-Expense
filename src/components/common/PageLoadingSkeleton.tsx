import React from 'react';
import { Loader2 } from 'lucide-react';

export const PageLoadingSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-6 animate-pulse py-2">
      {/* Top Banner / Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#222] pb-5">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-[#1e1e1e]" />
          <div className="h-4 w-72 rounded-md bg-[#161616]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-lg bg-[#1e1e1e]" />
          <div className="h-9 w-32 rounded-lg bg-[#2563eb]/30" />
        </div>
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[#222] bg-[#121212] p-4.5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 rounded bg-[#1e1e1e]" />
              <div className="h-8 w-8 rounded-lg bg-[#1a1a1a]" />
            </div>
            <div className="h-7 w-32 rounded bg-[#222]" />
            <div className="h-3.5 w-24 rounded bg-[#161616]" />
          </div>
        ))}
      </div>

      {/* Primary Content Skeleton (Chart & Table Area) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-[#222] bg-[#121212] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-36 rounded bg-[#1e1e1e]" />
            <div className="h-4 w-20 rounded bg-[#161616]" />
          </div>
          <div className="h-64 rounded-lg bg-[#161616]/70 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span>Loading view modules...</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#222] bg-[#121212] p-5 space-y-4">
          <div className="h-5 w-28 rounded bg-[#1e1e1e]" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="flex items-center justify-between py-2 border-b border-[#1c1c1c]">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-[#1e1e1e]" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-20 rounded bg-[#1e1e1e]" />
                    <div className="h-2.5 w-14 rounded bg-[#161616]" />
                  </div>
                </div>
                <div className="h-4 w-12 rounded bg-[#1e1e1e]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
