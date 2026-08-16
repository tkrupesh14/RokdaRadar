import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { getProvider, getOperatorSigner, getOracleSigner } from "./provider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the ABI straight from Hardhat's compiled artifact rather than hand-
// duplicating it, so the API can never drift from the deployed bytecode.
const ARTIFACT_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "contracts",
  "artifacts",
  "contracts",
  "ReliefTraceIN.sol",
  "ReliefTraceIN.json"
);

let cachedAbi: ethers.InterfaceAbi | null = null;

export function getContractAbi(): ethers.InterfaceAbi {
  if (!cachedAbi) {
    if (!fs.existsSync(ARTIFACT_PATH)) {
      throw new Error(
        `Contract artifact not found at ${ARTIFACT_PATH}. Run "npm run contracts:compile" first.`
      );
    }
    const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
    cachedAbi = artifact.abi as ethers.InterfaceAbi;
  }
  return cachedAbi;
}

export function getReadContract(): ethers.Contract {
  if (!env.CONTRACT_ADDRESS) {
    throw new Error("CONTRACT_ADDRESS is not configured");
  }
  return new ethers.Contract(env.CONTRACT_ADDRESS, getContractAbi(), getProvider());
}

export function getOperatorContract(): ethers.Contract {
  if (!env.CONTRACT_ADDRESS) {
    throw new Error("CONTRACT_ADDRESS is not configured");
  }
  return new ethers.Contract(env.CONTRACT_ADDRESS, getContractAbi(), getOperatorSigner());
}

export function getOracleContract(): ethers.Contract {
  if (!env.CONTRACT_ADDRESS) {
    throw new Error("CONTRACT_ADDRESS is not configured");
  }
  return new ethers.Contract(env.CONTRACT_ADDRESS, getContractAbi(), getOracleSigner());
}
