import { prisma } from "../lib/prisma";

const DEV_USER_EMAIL = "dev@local.test";

export async function getOrCreateDevUser() {
  return prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: {},
    create: {
      email: DEV_USER_EMAIL,
      name: "Dev User",
      isDev: true,
    },
  });
}
