import nodemailer from "nodemailer";
import type { SenderConfig } from "@prisma/client";
import { logger } from "../lib/logger";

export interface EtherealCredentials {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

export async function createEtherealAccount(): Promise<EtherealCredentials> {
  const account = await nodemailer.createTestAccount();
  return {
    smtpHost: account.smtp.host,
    smtpPort: account.smtp.port,
    smtpUser: account.user,
    smtpPass: account.pass,
  };
}

export function buildTransport(sender: Pick<SenderConfig, "smtpHost" | "smtpPort" | "smtpUser" | "smtpPass">) {
  return nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465,
    auth: { user: sender.smtpUser, pass: sender.smtpPass },
  });
}

export interface SendResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmail(
  sender: Pick<SenderConfig, "smtpHost" | "smtpPort" | "smtpUser" | "smtpPass" | "fromAddress" | "name">,
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  const transport = buildTransport(sender);
  const info = await transport.sendMail({
    from: `"${sender.name}" <${sender.fromAddress}>`,
    to,
    subject,
    html: body,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  logger.info({ to, previewUrl }, "Email sent via Ethereal");
  return { messageId: info.messageId, previewUrl };
}
