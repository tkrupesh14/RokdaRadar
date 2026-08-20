import { getPool, type Executor } from "../client.js";
import type { DeliveryAttestationRow } from "../../types/domain.js";

export async function insertDeliveryAttestation(
  row: Omit<DeliveryAttestationRow, "id">,
  exec: Executor = getPool()
): Promise<void> {
  await exec.query(
    `INSERT INTO delivery_attestations (spend_ref, attestor, ts, tx_hash) VALUES ($1, $2, $3, $4)`,
    [row.spend_ref, row.attestor, row.ts, row.tx_hash]
  );
}

export async function listDeliveryAttestations(
  spendRef: string,
  exec: Executor = getPool()
): Promise<DeliveryAttestationRow[]> {
  const result = await exec.query(`SELECT * FROM delivery_attestations WHERE spend_ref = $1 ORDER BY ts`, [spendRef]);
  return result.rows as DeliveryAttestationRow[];
}
