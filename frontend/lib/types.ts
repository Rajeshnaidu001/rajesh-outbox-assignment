export type EmailStatus = "scheduled" | "sending" | "sent" | "failed";

export interface EmailRow {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  error?: string | null;
  sender?: string;
}

export interface SenderConfigSummary {
  id: string;
  name: string;
  fromAddress: string;
  minDelaySeconds: number;
  hourlyLimit: number;
  createdAt: string;
}
