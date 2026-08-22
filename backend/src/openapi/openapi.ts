import swaggerJsdoc from "swagger-jsdoc";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const definition = {
  openapi: "3.0.3",
  info: {
    title: "ReliefTrace API",
    version: "0.1.0",
    description:
      "Backend API for ReliefTrace, MVP-0. The chain never custodies value: contracts store attestations only. " +
      "See ReliefTrace_HLD.md / ReliefTrace_LLD.md at the repo root for the full architectural spec.",
  },
  servers: [{ url: `http://localhost:${env.PORT}`, description: "Local dev" }],
  tags: [
    { name: "Campaigns" },
    { name: "Aggregate" },
    { name: "Feed" },
    { name: "Donations" },
    { name: "Payments" },
    { name: "Spends" },
    { name: "Review" },
    { name: "Delivery" },
    { name: "Reports" },
    { name: "CSR" },
    { name: "Health" },
  ],
  components: {
    schemas: {
      Campaign: {
        type: "object",
        properties: {
          campaignId: { type: "integer" },
          operator: { type: "string" },
          disasterTag: { type: "string" },
          darpanId: { type: "string", nullable: true },
          reg80G: { type: "string", nullable: true },
          promiseHash: { type: "string" },
          raisedPaise: { type: "integer" },
          spentPaise: { type: "integer" },
          active: { type: "boolean" },
          createdAt: { type: "integer" },
        },
      },
      CreateCampaignRequest: {
        type: "object",
        required: ["oracleAddress", "disasterTag", "darpanId", "reg80G", "promiseText", "auth"],
        properties: {
          oracleAddress: { type: "string", description: "Backend oracle wallet address permitted to attest donations" },
          disasterTag: { type: "string", example: "KL-WAYANAD-2026-07" },
          darpanId: { type: "string" },
          reg80G: { type: "string" },
          promiseText: { type: "string", description: "Public appeal text; hashed server-side to promiseHash" },
          auth: { $ref: "#/components/schemas/SignedAuth" },
        },
      },
      CreateCampaignResponse: {
        type: "object",
        properties: { txHash: { type: "string" }, status: { type: "string" } },
      },
      SignedAuth: {
        type: "object",
        required: ["address", "nonce", "timestamp", "signature"],
        properties: {
          address: { type: "string" },
          nonce: { type: "string" },
          timestamp: { type: "integer", description: "epoch ms" },
          signature: { type: "string", description: "EIP-191 personal_sign over `${route}:${campaignId ?? \"\"}:${nonce}:${timestamp}`" },
        },
        description: "Produce this with scripts/signOperatorRequest.ts for manual/Swagger testing.",
      },
      Aggregate: {
        type: "object",
        description: "Deterministic aggregate JSON per LLD Section 3.4. The Intelligence Domain's only input.",
        properties: {
          campaignId: { type: "integer" },
          disasterTag: { type: "string" },
          raisedPaise: { type: "integer" },
          spentPaise: { type: "integer" },
          unspentPaise: { type: "integer" },
          donationCount: { type: "integer" },
          spendCount: { type: "integer" },
          categorySplit: { type: "object", additionalProperties: { type: "integer" } },
          fieldVsAdminRatio: { type: "number" },
          vendorConcentration: {
            type: "array",
            items: {
              type: "object",
              properties: {
                vendorRef: { type: "string" },
                sharePct: { type: "number" },
                spendCount: { type: "integer" },
              },
            },
          },
          medianDonationPaise: { type: "integer" },
          medianDisbursementLatencyHours: { type: "number" },
          evidencedSpendPct: { type: "number" },
          deliveryAttestedPct: { type: "number" },
          trustScore: {
            type: "integer",
            description:
              "0-100. Partial by design: only 2 of the 5 LLD Section 8 terms are computed today (see trustScoreBreakdown.pending) -- reweighted so the two real terms sum to 1.",
          },
          trustScoreBreakdown: {
            type: "object",
            properties: {
              evidencedSpendPct: { type: "number" },
              deliveryAttestedPct: { type: "number" },
              weights: {
                type: "object",
                properties: { evidencedSpendPct: { type: "number" }, deliveryAttestedPct: { type: "number" } },
              },
              pending: { type: "array", items: { type: "string" } },
            },
          },
          anomalyCandidates: {
            type: "array",
            items: {
              type: "object",
              properties: { spendRef: { type: "string" }, reason: { type: "string" }, value: {} },
            },
          },
          txIndex: { type: "object", additionalProperties: { type: "string" } },
        },
      },
      SpendRequest: {
        type: "object",
        required: ["vendorRef", "amountPaise", "category", "authAddress", "authNonce", "authTimestamp", "authSignature"],
        properties: {
          vendorRef: { type: "string", description: "Raw vendor identifier; hashed server-side, never stored raw" },
          amountPaise: { type: "integer" },
          category: { type: "string", enum: ["FOOD", "WATER", "MEDICAL", "SHELTER", "LOGISTICS", "ADMIN"] },
          memo: { type: "string" },
          evidenceFile: { type: "string", format: "binary" },
          authAddress: { type: "string" },
          authNonce: { type: "string" },
          authTimestamp: { type: "integer" },
          authSignature: { type: "string" },
        },
      },
      SpendResponse: {
        type: "object",
        properties: {
          spendRef: { type: "string" },
          txHash: { type: "string" },
          explorerUrl: { type: "string" },
          evidenceCID: { type: "string" },
          status: { type: "string" },
        },
      },
      PendingSpendResponse: {
        type: "object",
        description: "Evidence passed the Gemini bill/receipt screen and is queued for manager review -- not yet attested on-chain.",
        properties: {
          pendingSpendId: { type: "integer" },
          status: { type: "string", example: "pending_review" },
          evidenceCID: { type: "string" },
          aiReason: { type: "string" },
        },
      },
      PendingSpend: {
        type: "object",
        properties: {
          pendingSpendId: { type: "integer" },
          campaignId: { type: "integer" },
          amountPaise: { type: "integer" },
          category: { type: "string", enum: ["FOOD", "WATER", "MEDICAL", "SHELTER", "LOGISTICS", "ADMIN"] },
          memo: { type: "string", nullable: true },
          evidenceCID: { type: "string" },
          aiReason: { type: "string", nullable: true },
          operatorAddress: { type: "string" },
          submittedAt: { type: "integer" },
          status: { type: "string", enum: ["pending", "approved", "rejected", "ai_rejected"] },
          reviewedAt: { type: "integer", nullable: true },
          reviewerAddress: { type: "string", nullable: true, description: "Manager address, or the synthetic \"ai:gemini\" marker for an AI auto-rejection" },
          reviewNote: { type: "string", nullable: true },
          txHash: { type: "string", nullable: true, description: "Set once approved and attested on-chain" },
        },
      },
      ReviewRequest: {
        type: "object",
        required: ["authAddress", "authNonce", "authTimestamp", "authSignature"],
        description: "Signed by a campaign manager address (see MANAGER_ALLOWLIST). Canonical message uses the literal route \"POST /api/pending-spends/:id/approve\" or \"/reject\", bound to this pending spend's campaignId.",
        properties: {
          authAddress: { type: "string" },
          authNonce: { type: "string" },
          authTimestamp: { type: "integer" },
          authSignature: { type: "string" },
          note: { type: "string" },
        },
      },
      DeliverRequest: {
        type: "object",
        required: ["authAddress", "authNonce", "authTimestamp", "authSignature"],
        properties: {
          authAddress: { type: "string" },
          authNonce: { type: "string" },
          authTimestamp: { type: "integer" },
          authSignature: { type: "string" },
        },
      },
      UpiWebhookPayload: {
        type: "object",
        properties: {
          event: { type: "string", example: "payment.captured" },
          payload: {
            type: "object",
            properties: {
              payment: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  amount: { type: "integer" },
                  utr: { type: "string" },
                  vpa: { type: "string" },
                  notes: { type: "object", properties: { campaignId: { type: "string" } } },
                },
              },
            },
          },
        },
      },
      CsrPortfolio: {
        type: "object",
        description: "One shared portfolio across every real on-chain campaign -- no company/donor attribution exists, see the route's own description.",
        properties: {
          campaignCount: { type: "integer" },
          totalRaisedPaise: { type: "integer" },
          totalSpentPaise: { type: "integer" },
          avgTrustScore: { type: "integer" },
          avgEvidencedSpendPct: { type: "number", description: "Spend-weighted, not a simple average across campaigns." },
          campaignsWithAnomalies: { type: "integer" },
          campaigns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                campaignId: { type: "integer" },
                operator: { type: "string" },
                disasterTag: { type: "string" },
                darpanId: { type: "string", nullable: true },
                reg80G: { type: "string", nullable: true },
                active: { type: "boolean" },
                raisedPaise: { type: "integer" },
                spentPaise: { type: "integer" },
                trustScore: { type: "integer" },
                evidencedSpendPct: { type: "number" },
                anomalyCount: { type: "integer" },
              },
            },
          },
        },
      },
      Report: {
        type: "object",
        description: "Guardrail-validated AI report per LLD Section 4.2.",
        properties: {
          generatedAt: { type: "string" },
          headline: { type: "string" },
          summary: { type: "string" },
          breakdown: {
            type: "array",
            items: {
              type: "object",
              properties: { category: { type: "string" }, text: { type: "string" }, ref: { type: "string" } },
            },
          },
          anomalies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                spendRef: { type: "string" },
                severity: { type: "string", enum: ["info", "query", "concern"] },
                finding: { type: "string" },
                reasoning: { type: "string" },
              },
            },
          },
          promiseConsistency: {
            type: "object",
            properties: { verdict: { type: "string", enum: ["aligned", "drifting", "mismatch"] }, text: { type: "string" } },
          },
          translations: { type: "object", additionalProperties: true },
        },
      },
    },
  },
};

export const openapiSpec = swaggerJsdoc({
  definition,
  apis: [path.join(__dirname, "..", "routes", "*.ts"), path.join(__dirname, "..", "routes", "*.js")],
});
