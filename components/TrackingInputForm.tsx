"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface TrackingInputFormProps {
  buttonLabel?: string;
  className?: string;
}

export function TrackingInputForm({
  buttonLabel = "Track Pickup",
  className = "",
}: TrackingInputFormProps) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = token.trim().toUpperCase();
    if (!clean) {
      setError("Please enter your tracking code.");
      return;
    }
    setError(null);
    router.push(`/track/${clean}`);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-2 ${className}`}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. RLP-HYD-A7F2"
            aria-label="Enter your 8-character tracking code"
            className="w-full rounded-[3px] border border-[#d8ddd7] bg-white px-3.5 py-2.5 font-mono text-xs uppercase text-[#151817] placeholder:text-[#a1aaa4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57]"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          className="whitespace-nowrap px-5 py-2.5"
        >
          {buttonLabel} &rarr;
        </Button>
      </div>
      {error && (
        <p className="text-[11px] font-medium text-[#991b1b]">{error}</p>
      )}
    </form>
  );
}
