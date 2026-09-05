import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { createEtherealAccount } from "../services/mailer";

export const sendersRouter = Router();
sendersRouter.use(requireAuth);

const createSenderSchema = z.object({
  name: z.string().min(1),
  fromAddress: z.string().email(),
  minDelaySeconds: z.number().int().min(0).default(2),
  hourlyLimit: z.number().int().min(1).default(50),
});

sendersRouter.get("/", async (req, res) => {
  const senders = await prisma.senderConfig.findMany({
    where: { userId: req.authUserId },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    senders.map((s) => ({
      id: s.id,
      name: s.name,
      fromAddress: s.fromAddress,
      minDelaySeconds: s.minDelaySeconds,
      hourlyLimit: s.hourlyLimit,
      createdAt: s.createdAt,
    }))
  );
});

sendersRouter.post("/", async (req, res) => {
  const parsed = createSenderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const credentials = await createEtherealAccount();

  const sender = await prisma.senderConfig.create({
    data: {
      userId: req.authUserId!,
      name: parsed.data.name,
      fromAddress: parsed.data.fromAddress,
      minDelaySeconds: parsed.data.minDelaySeconds,
      hourlyLimit: parsed.data.hourlyLimit,
      ...credentials,
    },
  });

  res.status(201).json({
    id: sender.id,
    name: sender.name,
    fromAddress: sender.fromAddress,
    minDelaySeconds: sender.minDelaySeconds,
    hourlyLimit: sender.hourlyLimit,
    createdAt: sender.createdAt,
  });
});
