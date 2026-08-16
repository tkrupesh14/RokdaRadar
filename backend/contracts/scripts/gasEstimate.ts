// One-off: measure gas used per function call against local Hardhat network
// to estimate a real MON budget for testnet before committing real funds.
import { ethers } from "hardhat";

async function main() {
  const [operator, oracle, attestor] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("ReliefTraceIN");

  const deployTx = await Factory.connect(operator).deploy();
  const deployReceipt = await deployTx.deploymentTransaction()?.wait();
  console.log("deploy:", deployReceipt?.gasUsed.toString());

  const contract = await deployTx.waitForDeployment();
  const promiseHash = ethers.keccak256(ethers.toUtf8Bytes("help"));

  const createTx = await contract
    .connect(operator)
    .createCampaign(oracle.address, "TEST-TAG", "DARPAN1", "80G1", promiseHash);
  const createReceipt = await createTx.wait();
  console.log("createCampaign:", createReceipt!.gasUsed.toString());

  const donateTx = await contract
    .connect(oracle)
    .attestDonation(0, ethers.ZeroHash, ethers.ZeroHash, 50000n);
  const donateReceipt = await donateTx.wait();
  console.log("attestDonation:", donateReceipt!.gasUsed.toString());

  const vendorRef = ethers.keccak256(ethers.toUtf8Bytes("vendor"));
  const spendTx = await contract
    .connect(operator)
    .attestSpend(0, ethers.ZeroHash, vendorRef, 18400n, 0, "cid", "memo");
  const spendReceipt = await spendTx.wait();
  console.log("attestSpend:", spendReceipt!.gasUsed.toString());

  const parsed = spendReceipt!.logs
    .map((l: any) => {
      try {
        return contract.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p: any) => p?.name === "SpendAttested");
  const spendRef = parsed!.args.spendRef;

  const deliverTx = await contract.connect(attestor).attestDelivery(0, spendRef);
  const deliverReceipt = await deliverTx.wait();
  console.log("attestDelivery:", deliverReceipt!.gasUsed.toString());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
