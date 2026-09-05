import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../auth/jwt";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const payload = verifyAuthToken(header.slice("Bearer ".length));
    req.authUserId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
