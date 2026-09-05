"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import type { SenderConfigSummary } from "@/lib/types";

const NEW_SENDER = "__new__";

interface Props {
  open: boolean;
  onClose: () => void;
  onScheduled: (count: number) => void;
}

function defaultStartTime(): string {
  const now = new Date(Date.now() + 5 * 60 * 1000);
  now.setSeconds(0, 0);
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function ComposeModal({ open, onClose, onScheduled }: Props) {
  const [senders, setSenders] = useState<SenderConfigSummary[]>([]);
  const [senderId, setSenderId] = useState<string>("");
  const [newSenderName, setNewSenderName] = useState("");
  const [newSenderFrom, setNewSenderFrom] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [startTime, setStartTime] = useState(defaultStartTime());
  const [minDelaySeconds, setMinDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    apiFetch<SenderConfigSummary[]>("/api/senders")
      .then((list) => {
        setSenders(list);
        if (list.length > 0) {
          setSenderId(list[0].id);
          setMinDelaySeconds(list[0].minDelaySeconds);
          setHourlyLimit(list[0].hourlyLimit);
        } else {
          setSenderId(NEW_SENDER);
        }
      })
      .catch(() => setSenders([]));
  }, [open]);

  function handleSenderChange(id: string) {
    setSenderId(id);
    const sender = senders.find((s) => s.id === id);
    if (sender) {
      setMinDelaySeconds(sender.minDelaySeconds);
      setHourlyLimit(sender.hourlyLimit);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please upload a CSV of recipient emails.");
      return;
    }

    setSubmitting(true);
    try {
      let activeSenderId = senderId;
      if (senderId === NEW_SENDER) {
        if (!newSenderName || !newSenderFrom) {
          throw new Error("Enter a name and from-address for the new sender.");
        }
        const created = await apiFetch<SenderConfigSummary>("/api/senders", {
          method: "POST",
          body: JSON.stringify({
            name: newSenderName,
            fromAddress: newSenderFrom,
            minDelaySeconds,
            hourlyLimit,
          }),
        });
        activeSenderId = created.id;
      }

      const form = new FormData();
      form.set("subject", subject);
      form.set("body", body);
      form.set("senderConfigId", activeSenderId);
      form.set("startTime", new Date(startTime).toISOString());
      form.set("minDelaySeconds", String(minDelaySeconds));
      form.set("hourlyLimit", String(hourlyLimit));
      form.set("recipients", file);

      const result = await apiFetch<{ scheduledCount: number }>("/api/campaigns", {
        method: "POST",
        body: form,
      });

      onScheduled(result.scheduledCount);
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule campaign");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAndClose() {
    setSubject("");
    setBody("");
    setFile(null);
    setStartTime(defaultStartTime());
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-fg">Compose campaign</h2>
          <button onClick={resetAndClose} className="text-muted hover:text-fg" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Subject</label>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Your subject line"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Body</label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="HTML or plain text body"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Recipients CSV</label>
            <input
              required
              type="file"
              accept=".csv,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-fg"
            />
            <p className="mt-1 text-xs text-muted">A column named "email", or one address per line.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Start time</label>
            <input
              required
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-fg">Delay between emails (s)</label>
              <input
                required
                type="number"
                min={0}
                value={minDelaySeconds}
                onChange={(e) => setMinDelaySeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg">Hourly limit</label>
              <input
                required
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Sender</label>
            <select
              value={senderId}
              onChange={(e) => handleSenderChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.fromAddress})
                </option>
              ))}
              <option value={NEW_SENDER}>+ New sender…</option>
            </select>
          </div>

          {senderId === NEW_SENDER && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-dashed border-border p-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-fg">Sender name</label>
                <input
                  value={newSenderName}
                  onChange={(e) => setNewSenderName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Marketing Team"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-fg">From address</label>
                <input
                  type="email"
                  value={newSenderFrom}
                  onChange={(e) => setNewSenderFrom(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="team@yourcompany.com"
                />
              </div>
              <p className="col-span-2 text-xs text-muted">
                A fresh Ethereal test-SMTP inbox is generated automatically for this sender.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Scheduling…" : "Schedule campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
