import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "BAD_REQUEST", detail: err.flatten() });
    return;
  }

  console.error(err);
  const status = err?.status ?? 500;
  res.status(status).json({
    error: err?.code ?? "INTERNAL_ERROR",
    detail: err?.message ?? "An unexpected error occurred",
  });
};
