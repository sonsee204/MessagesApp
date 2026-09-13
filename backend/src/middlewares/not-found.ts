import { Request, Response, NextFunction } from "express";
import { NotFoundError } from "../core/errors";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`));
}
