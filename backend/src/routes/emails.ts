import { Router } from "express";
import { EmailStatus, type Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

emailsRouter.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const statusFilter: EmailStatus[] | undefined =
    status === "scheduled"
      ? [EmailStatus.scheduled, EmailStatus.sending]
      : status === "sent"
        ? [EmailStatus.sent, EmailStatus.failed]
        : undefined;

  const campaignId = req.query.campaignId as string | undefined;

  const where: Prisma.EmailJobWhereInput = {
    userId: req.authUserId!,
    ...(statusFilter ? { status: { in: statusFilter } } : {}),
    ...(campaignId ? { campaignId } : {}),
  };

  const emails = await prisma.emailJob.findMany({
    where,
    orderBy: status === "sent" ? { sentAt: "desc" } : { scheduledAt: "asc" },
    take: 200,
    include: { senderConfig: { select: { name: true, fromAddress: true } } },
  });

  res.json(
    emails.map((e) => ({
      id: e.id,
      recipient: e.recipient,
      subject: e.subject,
      body: e.body,
      status: e.status,
      scheduledAt: e.scheduledAt,
      sentAt: e.sentAt,
      error: e.error,
      sender: e.senderConfig.name,
    }))
  );
});

// Powers the sidebar nav badges — a cheap count query rather than reusing the
// (capped at 200) list endpoint, so the numbers stay accurate at any volume.
emailsRouter.get("/counts", async (req, res) => {
  const userId = req.authUserId!;
  const [scheduled, sent] = await Promise.all([
    prisma.emailJob.count({ where: { userId, status: { in: [EmailStatus.scheduled, EmailStatus.sending] } } }),
    prisma.emailJob.count({ where: { userId, status: { in: [EmailStatus.sent, EmailStatus.failed] } } }),
  ]);
  res.json({ scheduled, sent });
});
