"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function TrackLookupPage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim().toUpperCase();
    if (!clean) {
      setError("Please enter a valid tracking token.");
      return;
    }
    setError(null);
    router.push(`/track/${clean}`);
  };

  return (
    <div className="mx-auto max-w-xl py-8 sm:py-12 space-y-8">
      <div className="space-y-2">
        <Link
          href="/"
          className="text-xs font-semibold text-[#6b746e] hover:text-[#151817] inline-flex items-center gap-1"
        >
          &larr; Return to Home
        </Link>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#2e7d57] block font-bold">
          Civic Transparency Portal
        </span>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#151817]">
          Track Your E-Waste Pickup
        </h1>
        <p className="text-sm text-[#6b746e]">
          Follow your unwanted electronics through scheduled collection, verified scale weighing, and accredited recovery facility transfer.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enter Pickup Tracking Code</CardTitle>
          <CardDescription>
            Your tracking code was issued when you submitted your collection request (e.g. RLP-HYD-A7F2).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="tracking-token" className="block text-xs font-semibold text-[#151817] mb-1.5">
                Tracking Token
              </label>
              <input
                id="tracking-token"
                type="text"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="RLP-HYD-XXXX"
                className="w-full rounded-[3px] border border-[#d8ddd7] px-3.5 py-2.5 font-mono text-sm uppercase text-[#151817] placeholder:text-[#a1aaa4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57]"
                autoFocus
              />
              {error && <p className="mt-1 text-xs text-[#991b1b]">{error}</p>}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <Button type="submit" variant="primary" className="w-full sm:w-auto">
                Track Pickup &rarr;
              </Button>
              <Link href="/request" className="w-full sm:w-auto">
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  Schedule New Pickup
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-[3px] border border-[#d8ddd7] bg-white p-5 space-y-3">
        <h3 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
          What happens when you track:
        </h3>
        <ul className="space-y-2 text-xs text-[#6b746e]">
          <li className="flex items-start gap-2">
            <span className="font-mono text-[#2e7d57] font-bold">1.</span>
            <span>View your collection window and vehicle dispatch status in real time.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-[#2e7d57] font-bold">2.</span>
            <span>Inspect the digital scale weight recorded by the field collector at doorstep.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-[#2e7d57] font-bold">3.</span>
            <span>Verify transfer to certified recycler and final material recovery breakdown.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
