import type { ethers } from "ethers";
import { getProvider } from "../chain/provider.js";
import { getReadContract } from "../chain/contractClient.js";
import { getLastProcessedBlock, setLastProcessedBlock } from "../db/repositories/eventsRepo.js";
import {
  onCampaignCreated,
  onDonationAttested,
  onSpendAttested,
  onDeliveryAttested,
  type CampaignCreatedEvent,
  type DonationAttestedEvent,
  type SpendAttestedEvent,
  type DeliveryAttestedEvent,
} from "./handlers.js";

function toCampaignCreated(log: ethers.EventLog): CampaignCreatedEvent {
  const [id, operator, disasterTag, darpanId, promiseHash, ts] = log.args as unknown as [
    bigint,
    string,
    string,
    string,
    string,
    bigint
  ];
  return {
    txHash: log.transactionHash,
    logIndex: log.index,
    id: Number(id),
    operator,
    disasterTag,
    darpanId,
    promiseHash,
    ts: Number(ts),
  };
}

function toDonationAttested(log: ethers.EventLog): DonationAttestedEvent {
  const [id, utrHash, donorRef, amountPaise, ts] = log.args as unknown as [bigint, string, string, bigint, bigint];
  return {
    txHash: log.transactionHash,
    logIndex: log.index,
    id: Number(id),
    utrHash,
    donorRef,
    amountPaise: Number(amountPaise),
    ts: Number(ts),
  };
}

function toSpendAttested(log: ethers.EventLog): SpendAttestedEvent {
  const [id, spendRef, utrHash, vendorRef, amountPaise, cat, evidenceCID, memo, ts] = log.args as unknown as [
    bigint,
    string,
    string,
    string,
    bigint,
    bigint,
    string,
    string,
    bigint
  ];
  return {
    txHash: log.transactionHash,
    logIndex: log.index,
    id: Number(id),
    spendRef,
    utrHash,
    vendorRef,
    amountPaise: Number(amountPaise),
    cat: Number(cat),
    evidenceCID,
    memo,
    ts: Number(ts),
  };
}

function toDeliveryAttested(log: ethers.EventLog): DeliveryAttestedEvent {
  const [id, spendRef, attestor, ts] = log.args as unknown as [bigint, string, string, bigint];
  return {
    txHash: log.transactionHash,
    logIndex: log.index,
    id: Number(id),
    spendRef,
    attestor,
    ts: Number(ts),
  };
}

// Monad testnet's public RPC caps eth_getLogs to a 100-block range per call
// (confirmed directly: "eth_getLogs is limited to a 100 range"), far tighter
// than most EVM RPCs -- so any catch-up range must be paged in windows this
// size, never queried in one shot.
const LOG_QUERY_WINDOW = 100;

async function backfill(contract: ethers.Contract, provider: ethers.JsonRpcProvider): Promise<number> {
  const currentBlock = await provider.getBlockNumber();
  const lastProcessed = await getLastProcessedBlock();

  // Fresh indexer state (no prior run): start from the chain head rather
  // than genesis. Scanning a contract's entire pre-existing history in
  // 100-block windows would be thousands of RPC calls for no reason at
  // MVP0 -- catch-up only matters for gaps since the indexer's own last run.
  const fromBlock = lastProcessed === null ? currentBlock : lastProcessed + 1;

  const allLogs: ethers.EventLog[] = [];
  for (let windowStart = fromBlock; windowStart <= currentBlock; windowStart += LOG_QUERY_WINDOW) {
    const windowEnd = Math.min(windowStart + LOG_QUERY_WINDOW - 1, currentBlock);
    const logs = await contract.queryFilter("*", windowStart, windowEnd);
    allLogs.push(...(logs as ethers.EventLog[]));
  }

  // Apply in the exact order they were emitted so a spend's SpendAttested
  // handler (which recomputes anomalies) always sees consistent prior state.
  const sorted = allLogs.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);
  for (const log of sorted) {
    await applyLog(contract, log);
  }

  await setLastProcessedBlock(currentBlock);
  return currentBlock;
}

async function applyLog(contract: ethers.Contract, log: ethers.EventLog): Promise<void> {
  // queryFilter("*", ...) already returns fully-typed EventLog instances with
  // `.args` populated by ethers (matched against the contract's interface).
  // `args` is a read-only property there, so it can't be force-reassigned
  // onto the original object (Object.assign onto it throws in strict mode);
  // instead build a minimal plain object with only the 3 fields the
  // to*Event() converters below actually read. Falls back to manual parsing
  // only for the rare case a raw Log without pre-matched args is passed in.
  const args = log.args ?? contract.interface.parseLog({ topics: log.topics as string[], data: log.data })?.args;
  if (!args) return;
  const parsedName = log.fragment?.name;
  const enriched = { transactionHash: log.transactionHash, index: log.index, args } as unknown as ethers.EventLog;

  switch (parsedName) {
    case "CampaignCreated":
      await onCampaignCreated(toCampaignCreated(enriched));
      break;
    case "DonationAttested":
      await onDonationAttested(toDonationAttested(enriched));
      break;
    case "SpendAttested":
      await onSpendAttested(toSpendAttested(enriched));
      break;
    case "DeliveryAttested":
      await onDeliveryAttested(toDeliveryAttested(enriched));
      break;
    default:
      break;
  }
}

export async function startIndexer(): Promise<void> {
  const provider = getProvider();
  const contract = getReadContract();

  const caughtUpToBlock = await backfill(contract, provider);
  console.log(`[indexer] backfill complete up to block ${caughtUpToBlock}`);

  // Polling, not contract.on()/eth_newFilter: Monad testnet's public RPC
  // returns "Method not found" for eth_newFilter (confirmed directly),
  // which is what ethers' filter-based subscriptions rely on over HTTP.
  // Many public RPC endpoints disable stateful filters regardless of chain,
  // so polling is also the more portable choice generally. backfill() is
  // already chunked to the RPC's 100-block eth_getLogs cap and idempotent,
  // so re-running it on an interval is a correct, if slightly less instant,
  // substitute for push subscriptions -- comfortably inside the <3s
  // indexer-lag NFT (HLD Section 8) at a 2s poll interval.
  const POLL_INTERVAL_MS = 2000;
  setInterval(() => {
    backfill(contract, provider).catch((err) => {
      console.error("[indexer] poll error", err);
    });
  }, POLL_INTERVAL_MS);

  console.log(`[indexer] polling for new events every ${POLL_INTERVAL_MS}ms`);
}
