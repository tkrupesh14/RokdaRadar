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

async function backfill(contract: ethers.Contract, provider: ethers.JsonRpcProvider): Promise<number> {
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = (getLastProcessedBlock() ?? -1) + 1;

  if (fromBlock <= currentBlock) {
    const logs = await contract.queryFilter("*", fromBlock, currentBlock);
    // Apply in the exact order they were emitted so a spend's SpendAttested
    // handler (which recomputes anomalies) always sees consistent prior state.
    const sorted = [...logs].sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);
    for (const log of sorted) {
      applyLog(contract, log as ethers.EventLog);
    }
  }
  setLastProcessedBlock(currentBlock);
  return currentBlock;
}

function applyLog(contract: ethers.Contract, log: ethers.EventLog): void {
  const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
  if (!parsed) return;
  const enriched = Object.assign(Object.create(log), { args: parsed.args });

  switch (parsed.name) {
    case "CampaignCreated":
      onCampaignCreated(toCampaignCreated(enriched));
      break;
    case "DonationAttested":
      onDonationAttested(toDonationAttested(enriched));
      break;
    case "SpendAttested":
      onSpendAttested(toSpendAttested(enriched));
      break;
    case "DeliveryAttested":
      onDeliveryAttested(toDeliveryAttested(enriched));
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

  contract.on("CampaignCreated", (...args) => applyLog(contract, args[args.length - 1] as ethers.EventLog));
  contract.on("DonationAttested", (...args) => applyLog(contract, args[args.length - 1] as ethers.EventLog));
  contract.on("SpendAttested", (...args) => applyLog(contract, args[args.length - 1] as ethers.EventLog));
  contract.on("DeliveryAttested", (...args) => applyLog(contract, args[args.length - 1] as ethers.EventLog));

  console.log("[indexer] subscribed to live events");
}
