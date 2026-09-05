import type { EmailStatus } from "@/lib/types";

const STYLES: Record<EmailStatus, string> = {
  scheduled: "bg-accent/10 text-accent",
  sending: "bg-warning/10 text-warning",
  sent: "bg-success/10 text-success",
  failed: "bg-danger/10 text-danger",
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STYLES[status]}`}>
      {status}
    </span>
  );
}
