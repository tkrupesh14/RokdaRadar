import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = err?.status ?? 500;
  res.status(status).json({
    error: err?.code ?? "INTERNAL_ERROR",
    detail: err?.message ?? "An unexpected error occurred",
  });
};
