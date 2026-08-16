import { describe, it, expect } from "vitest";
import { validateEvidenceFile, scanForPossiblePii } from "../../src/evidence/validate.js";
import { EVIDENCE_MAX_BYTES } from "../../src/config/constants.js";

// Minimal valid PDF byte structure so buffer.toString("latin1") scanning is
// meaningfully exercised (the redaction check only inspects PDFs at MVP0,
// since there's no OCR for images until MVP1+).
function pdfBufferWithText(text: string): Buffer {
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< >>\nstream\n${text}\nendstream\nendobj\n%%EOF`, "latin1");
}

describe("evidence upload validation (LLD Section 6 / 11)", () => {
  it("accepts an allowed mime type under the size limit", () => {
    expect(validateEvidenceFile({ mimetype: "application/pdf", size: 1024 })).toBeNull();
    expect(validateEvidenceFile({ mimetype: "image/jpeg", size: 1024 })).toBeNull();
    expect(validateEvidenceFile({ mimetype: "image/png", size: 1024 })).toBeNull();
  });

  it("rejects an oversized file", () => {
    const result = validateEvidenceFile({ mimetype: "application/pdf", size: EVIDENCE_MAX_BYTES + 1 });
    expect(result?.code).toBe("FILE_TOO_LARGE");
  });

  it("rejects a disallowed mime type", () => {
    const result = validateEvidenceFile({ mimetype: "application/zip", size: 1024 });
    expect(result?.code).toBe("UNSUPPORTED_MIME_TYPE");
  });

  it("flags a synthetic Aadhaar-shaped number in a PDF for manual redaction", () => {
    const buffer = pdfBufferWithText("Beneficiary Aadhaar: 1234 5678 9012");
    const result = scanForPossiblePii(buffer, "application/pdf");
    expect(result?.code).toBe("POSSIBLE_PII_DETECTED");
  });

  it("flags a synthetic PAN-shaped string in a PDF for manual redaction", () => {
    const buffer = pdfBufferWithText("PAN: ABCDE1234F");
    const result = scanForPossiblePii(buffer, "application/pdf");
    expect(result?.code).toBe("POSSIBLE_PII_DETECTED");
  });

  it("does not flag a clean PDF with no Aadhaar/PAN-shaped strings", () => {
    const buffer = pdfBufferWithText("Invoice for rice and lentils, amount 18400 paise");
    expect(scanForPossiblePii(buffer, "application/pdf")).toBeNull();
  });

  it("does not scan non-PDF files (no OCR until MVP1+)", () => {
    const buffer = Buffer.from("1234 5678 9012", "latin1");
    expect(scanForPossiblePii(buffer, "image/jpeg")).toBeNull();
  });
});
