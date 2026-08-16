import { AADHAAR_SHAPED_RE, EVIDENCE_MAX_BYTES, EVIDENCE_MIME_ALLOWLIST, PAN_SHAPED_RE } from "../config/constants.js";

export type EvidenceValidationError =
  | { code: "FILE_TOO_LARGE"; detail: string }
  | { code: "UNSUPPORTED_MIME_TYPE"; detail: string }
  | { code: "POSSIBLE_PII_DETECTED"; detail: string };

export function validateEvidenceFile(file: { mimetype: string; size: number }): EvidenceValidationError | null {
  if (!EVIDENCE_MIME_ALLOWLIST.includes(file.mimetype)) {
    return {
      code: "UNSUPPORTED_MIME_TYPE",
      detail: `File type ${file.mimetype} is not allowed. Allowed: ${EVIDENCE_MIME_ALLOWLIST.join(", ")}.`,
    };
  }
  if (file.size > EVIDENCE_MAX_BYTES) {
    return { code: "FILE_TOO_LARGE", detail: `File exceeds the ${EVIDENCE_MAX_BYTES / (1024 * 1024)}MB limit.` };
  }
  return null;
}

// MVP0 redaction rule (LLD Section 6): only PDFs carry extractable text at
// this stage (no OCR until MVP1+), so the scan only inspects PDF byte content
// for an Aadhaar/PAN-shaped string and asks for manual redaction rather than
// attempting to redact automatically.
export function scanForPossiblePii(buffer: Buffer, mimetype: string): EvidenceValidationError | null {
  if (mimetype !== "application/pdf") return null;
  const text = buffer.toString("latin1");
  if (AADHAAR_SHAPED_RE.test(text) || PAN_SHAPED_RE.test(text)) {
    return {
      code: "POSSIBLE_PII_DETECTED",
      detail: "This document appears to contain an Aadhaar- or PAN-shaped number. Please redact it and re-upload.",
    };
  }
  return null;
}
