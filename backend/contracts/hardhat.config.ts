import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import path from "node:path";

// Shared .env lives one level up, in backend/, not inside contracts/
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    monadTestnet: {
      url: process.env.MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz",
      chainId: Number(process.env.MONAD_TESTNET_CHAIN_ID || 10143),
      accounts: OPERATOR_PRIVATE_KEY ? [OPERATOR_PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    artifacts: "./artifacts",
    cache: "./cache",
  },
};

export default config;
