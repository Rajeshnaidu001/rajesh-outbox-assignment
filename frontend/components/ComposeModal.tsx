"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { apiFetch } from "@/lib/api";
import type { SenderConfigSummary } from "@/lib/types";
import { parseRecipientsCsv } from "@/lib/csv";

const NEW_SENDER = "__new__";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHIP_PREVIEW_COUNT = 3;

interface Props {
  open: boolean;
  onClose: () => void;
  onScheduled: (count: number) => void;
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ToolbarIcon({ d }: { d: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d={d} />
    </svg>
  );
}

function nextDayAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function toLocalInputValue(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function ComposeModal({ open, onClose, onScheduled }: Props) {
  const [senders, setSenders] = useState<SenderConfigSummary[]>([]);
  const [senderId, setSenderId] = useState<string>("");
  const [newSenderName, setNewSenderName] = useState("");
  const [newSenderFrom, setNewSenderFrom] = useState("");

  const [subject, setSubject] = useState("");
  const [manualRecipients, setManualRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[]>([]);
  const [showAllChips, setShowAllChips] = useState(false);

  const [minDelaySeconds, setMinDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);

  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [customDateTime, setCustomDateTime] = useState("");
  const sendLaterRef = useRef<HTMLDivElement>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (sendLaterRef.current && !sendLaterRef.current.contains(e.target as Node)) setSendLaterOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleSenderChange(id: string) {
    setSenderId(id);
    const sender = senders.find((s) => s.id === id);
    if (sender) {
      setMinDelaySeconds(sender.minDelaySeconds);
      setHourlyLimit(sender.hourlyLimit);
    }
  }

  function addRecipientFromInput() {
    const value = recipientInput.trim().replace(/,$/, "");
    if (value && EMAIL_RE.test(value) && !manualRecipients.includes(value)) {
      setManualRecipients((prev) => [...prev, value]);
    }
    setRecipientInput("");
  }

  function handleRecipientKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (recipientInput.trim()) {
        e.preventDefault();
        addRecipientFromInput();
      }
    } else if (e.key === "Backspace" && !recipientInput && manualRecipients.length > 0) {
      setManualRecipients((prev) => prev.slice(0, -1));
    }
  }

  async function handleFileChange(file: File | null) {
    setCsvFile(file);
    if (!file) {
      setCsvPreview([]);
      return;
    }
    setCsvPreview(parseRecipientsCsv(await file.text()));
  }

  const allChips = [...manualRecipients, ...csvPreview];
  const visibleChips = showAllChips ? allChips : allChips.slice(0, CHIP_PREVIEW_COUNT);
  const overflowCount = allChips.length - visibleChips.length;

  function removeChip(email: string) {
    setManualRecipients((prev) => prev.filter((r) => r !== email));
    if (csvPreview.includes(email)) {
      setCsvPreview((prev) => prev.filter((r) => r !== email));
    }
  }

  function exec(command: string, value?: string) {
    bodyRef.current?.focus();
    document.execCommand(command, false, value);
  }

  function applySendLaterPreset(date: Date) {
    setScheduledAt(date);
    setSendLaterOpen(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (allChips.length === 0) {
      setError("Add at least one recipient or upload a CSV.");
      return;
    }
    const bodyHtml = bodyRef.current?.innerHTML?.trim() ?? "";
    if (!bodyHtml) {
      setError("Write a message body.");
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
          body: JSON.stringify({ name: newSenderName, fromAddress: newSenderFrom, minDelaySeconds, hourlyLimit }),
        });
        activeSenderId = created.id;
      }

      const form = new FormData();
      form.set("subject", subject);
      form.set("body", bodyHtml);
      form.set("senderConfigId", activeSenderId);
      form.set("startTime", (scheduledAt ?? new Date()).toISOString());
      form.set("minDelaySeconds", String(minDelaySeconds));
      form.set("hourlyLimit", String(hourlyLimit));
      form.set("manualRecipients", JSON.stringify(manualRecipients));
      if (csvFile) form.set("recipients", csvFile);

      const result = await apiFetch<{ scheduledCount: number }>("/api/campaigns", { method: "POST", body: form });

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
    setManualRecipients([]);
    setRecipientInput("");
    setCsvFile(null);
    setCsvPreview([]);
    setScheduledAt(null);
    if (bodyRef.current) bodyRef.current.innerHTML = "";
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <button type="button" onClick={resetAndClose} className="flex items-center gap-2 text-sm font-medium text-fg">
            <BackIcon />
            Compose New Email
          </button>
          <div className="relative flex items-center gap-2" ref={sendLaterRef}>
            <button
              type="button"
              onClick={() => setSendLaterOpen((v) => !v)}
              title="Schedule send time"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-hover"
            >
              <ToolbarIcon d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                scheduledAt ? "border border-accent text-accent hover:bg-accent-soft" : "bg-accent text-accent-fg hover:bg-accent-hover"
              }`}
            >
              {submitting ? "Sending…" : scheduledAt ? "Send Later" : "Send"}
            </button>

            {sendLaterOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-border bg-surface p-3 shadow-xl">
                <div className="mb-2 text-sm font-medium text-fg">Send Later</div>
                <input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  className="mb-2 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="space-y-0.5">
                  {[
                    { label: "Tomorrow, 9:00 AM", date: nextDayAt(9) },
                    { label: "Tomorrow, 10:00 AM", date: nextDayAt(10) },
                    { label: "Tomorrow, 11:00 AM", date: nextDayAt(11) },
                    { label: "Tomorrow, 3:00 PM", date: nextDayAt(15) },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => applySendLaterPreset(opt.date)}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-hover"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex justify-end gap-2 border-t border-border pt-2">
                  <button type="button" onClick={() => setSendLaterOpen(false)} className="rounded-md px-3 py-1 text-sm text-muted hover:bg-surface-hover">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (customDateTime) applySendLaterPreset(new Date(customDateTime));
                      else setSendLaterOpen(false);
                    }}
                    className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-fg hover:bg-accent-hover"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-3 border-b border-border pb-2 text-sm">
            <label className="w-14 shrink-0 text-muted">From</label>
            <select
              value={senderId}
              onChange={(e) => handleSenderChange(e.target.value)}
              className="flex-1 bg-transparent text-fg focus:outline-none"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fromAddress}
                </option>
              ))}
              <option value={NEW_SENDER}>+ New sender…</option>
            </select>
          </div>

          {senderId === NEW_SENDER && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed border-border p-3">
              <input
                value={newSenderName}
                onChange={(e) => setNewSenderName(e.target.value)}
                placeholder="Sender name"
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <input
                type="email"
                value={newSenderFrom}
                onChange={(e) => setNewSenderFrom(e.target.value)}
                placeholder="from@yourcompany.com"
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <p className="col-span-2 text-xs text-muted">A fresh Ethereal test-SMTP inbox is generated automatically.</p>
            </div>
          )}

          <div className="flex items-start gap-3 border-b border-border pb-2 text-sm">
            <label className="w-14 shrink-0 pt-1.5 text-muted">To</label>
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {visibleChips.map((email) => (
                <span key={email} className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-fg">
                  {email}
                  <button type="button" onClick={() => removeChip(email)} className="text-accent-soft-fg/70 hover:text-accent-soft-fg">
                    ×
                  </button>
                </span>
              ))}
              {overflowCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllChips(true)}
                  className="rounded-full bg-surface-hover px-2.5 py-1 text-xs font-medium text-muted hover:text-fg"
                >
                  +{overflowCount}
                </button>
              )}
              <input
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleRecipientKeyDown}
                onBlur={addRecipientFromInput}
                placeholder={allChips.length === 0 ? "recipient@example.com" : ""}
                className="min-w-[10ch] flex-1 bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 whitespace-nowrap text-xs font-medium text-accent hover:underline"
            >
              {csvFile ? `${csvFile.name} ✕` : "↑ Upload List"}
            </button>
          </div>

          <div className="flex items-center gap-3 border-b border-border pb-2 text-sm">
            <label className="w-14 shrink-0 text-muted">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 bg-transparent text-fg placeholder:text-muted focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-6 pb-1 text-sm">
            <div className="flex items-center gap-2">
              <label className="text-muted">Delay between 2 emails</label>
              <input
                type="number"
                min={0}
                value={minDelaySeconds}
                onChange={(e) => setMinDelaySeconds(Number(e.target.value))}
                className="w-14 rounded-md border border-border bg-bg px-2 py-1 text-center text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted">Hourly Limit</label>
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-14 rounded-md border border-border bg-bg px-2 py-1 text-center text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <div
              ref={bodyRef}
              contentEditable
              data-placeholder="Type Your Reply..."
              className="min-h-[140px] px-3 py-2.5 text-sm text-fg focus:outline-none"
              suppressContentEditableWarning
            />
            <div className="flex flex-wrap items-center gap-1 border-t border-border bg-surface-hover px-2 py-1.5">
              <button type="button" onClick={() => exec("undo")} className="rounded p-1.5 text-muted hover:bg-surface hover:text-fg">
                <ToolbarIcon d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-1" />
              </button>
              <button type="button" onClick={() => exec("redo")} className="rounded p-1.5 text-muted hover:bg-surface hover:text-fg">
                <ToolbarIcon d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h1" />
              </button>
              <span className="mx-1 h-4 w-px bg-border" />
              <button type="button" onClick={() => exec("bold")} className="rounded px-2 py-1 text-sm font-bold text-muted hover:bg-surface hover:text-fg">
                B
              </button>
              <button type="button" onClick={() => exec("italic")} className="rounded px-2 py-1 text-sm italic text-muted hover:bg-surface hover:text-fg">
                I
              </button>
              <button type="button" onClick={() => exec("underline")} className="rounded px-2 py-1 text-sm underline text-muted hover:bg-surface hover:text-fg">
                U
              </button>
              <button type="button" onClick={() => exec("strikeThrough")} className="rounded px-2 py-1 text-sm line-through text-muted hover:bg-surface hover:text-fg">
                S
              </button>
              <span className="mx-1 h-4 w-px bg-border" />
              <button type="button" onClick={() => exec("insertUnorderedList")} className="rounded p-1.5 text-muted hover:bg-surface hover:text-fg">
                <ToolbarIcon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </button>
              <button type="button" onClick={() => exec("insertOrderedList")} className="rounded p-1.5 text-muted hover:bg-surface hover:text-fg">
                <ToolbarIcon d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h1.5a1.5 1.5 0 1 1 0 3H4" />
              </button>
              <button type="button" onClick={() => exec("outdent")} className="rounded p-1.5 text-muted hover:bg-surface hover:text-fg">
                <ToolbarIcon d="M3 5h18M9 12h12M9 19h12M3 12l4-3v6l-4-3Z" />
              </button>
              <button type="button" onClick={() => exec("indent")} className="rounded p-1.5 text-muted hover:bg-surface hover:text-fg">
                <ToolbarIcon d="M3 5h18M9 12h12M9 19h12M7 9v6l4-3-4-3Z" />
              </button>
              <button type="button" onClick={() => exec("formatBlock", "blockquote")} className="rounded p-1.5 text-muted hover:bg-surface hover:text-fg">
                <ToolbarIcon d="M7 8c-2 0-3 1.5-3 3.5S5 15 7 15M17 8c-2 0-3 1.5-3 3.5s1 3.5 3 3.5" />
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </form>
    </div>
  );
}
