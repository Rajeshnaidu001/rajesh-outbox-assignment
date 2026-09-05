import type { EmailStatus } from "@/lib/types";

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function formatTime(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Matches the design's inbox-row status pill: scheduled/sending show a clock + timestamp
// in amber, sent is a plain neutral pill, failed is a plain red pill.
export function StatusBadge({ status, time }: { status: EmailStatus; time: string | null }) {
  if (status === "scheduled" || status === "sending") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
        <ClockIcon />
        {formatTime(time)}
      </span>
    );
  }

  if (status === "failed") {
    return <span className="inline-flex shrink-0 items-center rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">Failed</span>;
  }

  return <span className="inline-flex shrink-0 items-center rounded-full bg-surface-hover px-2.5 py-1 text-xs font-medium text-muted">Sent</span>;
}
