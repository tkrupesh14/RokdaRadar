import { getDb } from "../client.js";
import type { DeliveryAttestationRow } from "../../types/domain.js";

export function insertDeliveryAttestation(row: Omit<DeliveryAttestationRow, "id">): void {
  getDb()
    .prepare(
      `INSERT INTO delivery_attestations (spend_ref, attestor, ts, tx_hash)
       VALUES (@spend_ref, @attestor, @ts, @tx_hash)`
    )
    .run(row);
}

export function listDeliveryAttestations(spendRef: string): DeliveryAttestationRow[] {
  return getDb()
    .prepare(`SELECT * FROM delivery_attestations WHERE spend_ref = ? ORDER BY ts`)
    .all(spendRef) as DeliveryAttestationRow[];
}
