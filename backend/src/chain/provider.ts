import { ethers } from "ethers";
import { env, oraclePrivateKey } from "../config/env.js";

let providerInstance: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!providerInstance) {
    providerInstance = new ethers.JsonRpcProvider(env.MONAD_TESTNET_RPC_URL, {
      chainId: env.MONAD_TESTNET_CHAIN_ID,
      name: "monad-testnet",
    });
  }
  return providerInstance;
}

// The API's own server-held wallet: it submits attestSpend/createCampaign/
// closeCampaign transactions on behalf of operators (donors and operators
// never hold a gas-funded key themselves, per HLD Section 9).
export function getOperatorSigner(): ethers.Wallet {
  if (!env.OPERATOR_PRIVATE_KEY) {
    throw new Error("OPERATOR_PRIVATE_KEY is not configured");
  }
  return new ethers.Wallet(env.OPERATOR_PRIVATE_KEY, getProvider());
}

export function getOracleSigner(): ethers.Wallet {
  if (!oraclePrivateKey) {
    throw new Error("ORACLE_PRIVATE_KEY (or OPERATOR_PRIVATE_KEY) is not configured");
  }
  return new ethers.Wallet(oraclePrivateKey, getProvider());
}
