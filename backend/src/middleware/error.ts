import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { env } from "../config/env.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof SyntaxError && "body" in err) {
    console.error("JSON Parse Error:", err.message);
    res.status(400).json({
      error: "INVALID_JSON",
      message: "Invalid JSON payload",
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Invalid request data",
      details: err.issues,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: err.issues ?? [],
    });
    return;
  }

  console.error("Unhandled:", err);
  const message =
    env().NODE_ENV === "production"
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Internal error";
  res.status(500).json({ error: "INTERNAL_ERROR", message });
}
