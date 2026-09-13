import { Request, Response } from "express";

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      status: "healthy",
      service: "appmessaging-backend",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
}
