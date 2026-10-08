import React from "react";
import { Badge } from "./Badge";
import { getRequestStatusMeta, getRouteStatusMeta } from "@/lib/status-helper";

export interface StatusBadgeProps {
  status: string | null | undefined;
  type?: "request" | "route";
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  type = "request",
  size = "md",
  showDot = true,
  className = "",
}: StatusBadgeProps) {
  const meta = type === "route" ? getRouteStatusMeta(status) : getRequestStatusMeta(status);

  return (
    <Badge
      variant={meta.variant}
      size={size}
      showDot={showDot}
      className={className}
      title={meta.description}
    >
      {meta.label}
    </Badge>
  );
}
