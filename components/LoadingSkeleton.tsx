import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-sm bg-[#E6E3DA] dark:bg-[#2A2D29] ${className}`}
      aria-hidden="true"
    />
  );
}

export function ResultsPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8ddd7] pb-4 dark:border-[#2E322D]">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1 rounded-sm border border-[#d8ddd7] bg-[#FAF9F5] p-4 dark:border-[#2E322D] dark:bg-[#232722] flex flex-col items-center justify-center min-h-[160px]">
          <Skeleton className="h-28 w-28 rounded-sm" />
        </div>
        <div className="md:col-span-3 rounded-sm border border-[#d8ddd7] bg-[#FAF9F5] p-4 dark:border-[#2E322D] dark:bg-[#232722] space-y-3">
          <Skeleton className="h-4 w-36" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-[#d8ddd7] bg-[#FAF9F5] p-6 dark:border-[#2E322D] dark:bg-[#232722] space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>

      <div className="rounded-sm border border-[#d8ddd7] bg-[#FAF9F5] p-6 dark:border-[#2E322D] dark:bg-[#232722] space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>

      <div className="rounded-sm border border-[#d8ddd7] bg-[#FAF9F5] p-6 dark:border-[#2E322D] dark:bg-[#232722] space-y-4">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

export function DestinationsPageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8ddd7] pb-4 dark:border-[#2E322D]">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="rounded-sm border border-[#d8ddd7] bg-[#FAF9F5] p-4 dark:border-[#2E322D] dark:bg-[#232722] flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-60" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-sm border border-[#d8ddd7] bg-[#FAF9F5] p-4 dark:border-[#2E322D] dark:bg-[#232722] space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
        <div className="lg:col-span-7 rounded-sm border border-[#d8ddd7] bg-[#FAF9F5] p-2 dark:border-[#2E322D] dark:bg-[#232722]">
          <Skeleton className="h-[460px] w-full rounded-sm" />
        </div>
      </div>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8ddd7] pb-4 dark:border-[#2E322D]">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-3 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-28 w-full rounded-sm" />
        <Skeleton className="h-28 w-full rounded-sm" />
        <Skeleton className="h-28 w-full rounded-sm" />
        <Skeleton className="h-28 w-full rounded-sm" />
      </div>

      <div className="rounded-sm border border-[#d8ddd7] bg-[#FAF9F5] p-6 dark:border-[#2E322D] dark:bg-[#232722] space-y-4">
        <Skeleton className="h-5 w-52" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>

      <div className="rounded-sm border border-[#d8ddd7] bg-[#FAF9F5] p-6 dark:border-[#2E322D] dark:bg-[#232722] space-y-4">
        <Skeleton className="h-5 w-44" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
