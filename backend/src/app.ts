import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./openapi/openapi.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { aggregateRouter } from "./routes/aggregate.js";
import { feedRouter } from "./routes/feed.js";
import { donateRouter } from "./routes/donate.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { spendRouter } from "./routes/spend.js";
import { deliveryRouter } from "./routes/delivery.js";
import { reportRouter } from "./routes/report.js";
import { pendingSpendsRouter } from "./routes/pendingSpends.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(requestLogger);

  // Webhook route needs the raw body for HMAC verification, so it registers
  // its own express.raw() middleware and must be mounted before the global
  // express.json() parser below.
  app.use(webhooksRouter);

  app.use(express.json());

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
  app.get("/openapi.json", (_req, res) => res.json(openapiSpec));

  app.use(healthRouter);
  app.use(campaignsRouter);
  app.use(aggregateRouter);
  app.use(feedRouter);
  app.use(donateRouter);
  app.use(spendRouter);
  app.use(deliveryRouter);
  app.use(reportRouter);
  app.use(pendingSpendsRouter);

  app.use(errorHandler);

  return app;
}
