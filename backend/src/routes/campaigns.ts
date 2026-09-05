import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { parseRecipientsCsv } from "../services/csv";
import { createCampaign } from "../queues/scheduler";

export const campaignsRouter = Router();
campaignsRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const createCampaignSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  senderConfigId: z.string().min(1),
  startTime: z.coerce.date(),
  minDelaySeconds: z.coerce.number().int().min(0).optional(),
  hourlyLimit: z.coerce.number().int().min(1).optional(),
});

campaignsRouter.post("/", upload.single("recipients"), async (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "Missing recipients CSV file" });
    return;
  }

  const sender = await prisma.senderConfig.findFirst({
    where: { id: parsed.data.senderConfigId, userId: req.authUserId },
  });
  if (!sender) {
    res.status(404).json({ error: "Sender not found" });
    return;
  }

  const recipients = parseRecipientsCsv(req.file.buffer);
  if (recipients.length === 0) {
    res.status(400).json({ error: "No valid email addresses found in the uploaded file" });
    return;
  }

  // The delay/hourly-limit inputs on the compose form live on the sender config (they're what
  // the Redis rate-limit gates actually key off), so submitting a campaign updates them.
  if (parsed.data.minDelaySeconds !== undefined || parsed.data.hourlyLimit !== undefined) {
    await prisma.senderConfig.update({
      where: { id: sender.id },
      data: {
        minDelaySeconds: parsed.data.minDelaySeconds ?? sender.minDelaySeconds,
        hourlyLimit: parsed.data.hourlyLimit ?? sender.hourlyLimit,
      },
    });
  }

  const { campaign, emailJobs } = await createCampaign({
    userId: req.authUserId!,
    senderConfigId: sender.id,
    subject: parsed.data.subject,
    body: parsed.data.body,
    recipients,
    startTime: parsed.data.startTime,
  });

  res.status(201).json({ campaignId: campaign.id, scheduledCount: emailJobs.length });
});
