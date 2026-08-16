import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No signer available. Set OPERATOR_PRIVATE_KEY in backend/.env before running this deploy script."
    );
  }

  console.log(`Deploying ReliefTraceIN to '${network.name}' from ${deployer.address}...`);

  const Factory = await ethers.getContractFactory("ReliefTraceIN");
  const contract = await Factory.deploy();
  const receipt = await contract.deploymentTransaction()?.wait();

  const address = await contract.getAddress();
  const deployedAtBlock = receipt?.blockNumber ?? null;
  const txHash = receipt?.hash ?? contract.deploymentTransaction()?.hash ?? null;
  const chainId = (await ethers.provider.getNetwork()).chainId.toString();

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);

  fs.writeFileSync(
    outFile,
    JSON.stringify({ address, txHash, deployedAtBlock, chainId, network: network.name }, null, 2)
  );

  console.log(`Deployed ReliefTraceIN at ${address} (tx ${txHash}, block ${deployedAtBlock})`);
  console.log(`Wrote deployment record to ${outFile}`);
  console.log(`Set CONTRACT_ADDRESS=${address} in backend/.env`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
