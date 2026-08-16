import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import fs from "node:fs";
import path from "node:path";

const CATEGORY = { FOOD: 0, WATER: 1, MEDICAL: 2, SHELTER: 3, LOGISTICS: 4, ADMIN: 5 };

describe("ReliefTraceIN", () => {
  async function deployFixture() {
    const [operator, oracle, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ReliefTraceIN");
    const contract = await Factory.connect(operator).deploy();
    await contract.waitForDeployment();
    return { contract, operator, oracle, other };
  }

  async function createCampaign(contract: any, operator: any, oracle: any) {
    const promiseHash = ethers.keccak256(ethers.toUtf8Bytes("help wayanad"));
    const tx = await contract
      .connect(operator)
      .createCampaign(oracle.address, "KL-WAYANAD-2026-07", "DARPAN123", "80G456", promiseHash);
    await tx.wait();
    return 0n; // first campaign id
  }

  it("creates a campaign and emits CampaignCreated", async () => {
    const { contract, operator, oracle } = await deployFixture();
    const promiseHash = ethers.keccak256(ethers.toUtf8Bytes("help wayanad"));

    await expect(contract.connect(operator).createCampaign(oracle.address, "KL-WAYANAD-2026-07", "DARPAN123", "80G456", promiseHash))
      .to.emit(contract, "CampaignCreated");

    const campaign = await contract.campaigns(0);
    expect(campaign.operator).to.equal(operator.address);
    expect(campaign.oracle).to.equal(oracle.address);
    expect(campaign.active).to.equal(true);
  });

  it("attests a donation and increments raisedPaise", async () => {
    const { contract, operator, oracle } = await deployFixture();
    const id = await createCampaign(contract, operator, oracle);

    const utrHash = ethers.keccak256(ethers.toUtf8Bytes("utr-1"));
    const donorRef = ethers.keccak256(ethers.toUtf8Bytes("donor-1"));

    await expect(contract.connect(oracle).attestDonation(id, utrHash, donorRef, 50000n))
      .to.emit(contract, "DonationAttested")
      .withArgs(id, utrHash, donorRef, 50000n, anyValue);

    const campaign = await contract.campaigns(id);
    expect(campaign.raisedPaise).to.equal(50000n);
  });

  it("reverts attestDonation from non-oracle with 'not oracle'", async () => {
    const { contract, operator, oracle, other } = await deployFixture();
    const id = await createCampaign(contract, operator, oracle);
    const utrHash = ethers.keccak256(ethers.toUtf8Bytes("utr-1"));
    const donorRef = ethers.keccak256(ethers.toUtf8Bytes("donor-1"));

    await expect(
      contract.connect(other).attestDonation(id, utrHash, donorRef, 50000n)
    ).to.be.revertedWith("not oracle");
  });

  it("attests a spend with evidence and returns a spendRef", async () => {
    const { contract, operator, oracle } = await deployFixture();
    const id = await createCampaign(contract, operator, oracle);
    const vendorRef = ethers.keccak256(ethers.toUtf8Bytes("vendor-1"));

    await expect(
      contract
        .connect(operator)
        .attestSpend(id, ethers.ZeroHash, vendorRef, 18400n, CATEGORY.FOOD, "bafy-evidence-cid", "rice and lentils")
    ).to.emit(contract, "SpendAttested");

    const campaign = await contract.campaigns(id);
    expect(campaign.spentPaise).to.equal(18400n);
  });

  it("reverts attestSpend with empty evidenceCID with 'evidence required'", async () => {
    const { contract, operator, oracle } = await deployFixture();
    const id = await createCampaign(contract, operator, oracle);
    const vendorRef = ethers.keccak256(ethers.toUtf8Bytes("vendor-1"));

    await expect(
      contract.connect(operator).attestSpend(id, ethers.ZeroHash, vendorRef, 18400n, CATEGORY.FOOD, "", "no evidence")
    ).to.be.revertedWith("evidence required");
  });

  it("reverts attestSpend from non-operator with 'not operator'", async () => {
    const { contract, operator, oracle, other } = await deployFixture();
    const id = await createCampaign(contract, operator, oracle);
    const vendorRef = ethers.keccak256(ethers.toUtf8Bytes("vendor-1"));

    await expect(
      contract.connect(other).attestSpend(id, ethers.ZeroHash, vendorRef, 18400n, CATEGORY.FOOD, "cid", "memo")
    ).to.be.revertedWith("not operator");
  });

  it("reverts closeCampaign from non-operator with 'not operator'", async () => {
    const { contract, operator, oracle, other } = await deployFixture();
    const id = await createCampaign(contract, operator, oracle);

    await expect(contract.connect(other).closeCampaign(id)).to.be.revertedWith("not operator");
  });

  it("reverts any attest call on an inactive campaign with 'inactive'", async () => {
    const { contract, operator, oracle } = await deployFixture();
    const id = await createCampaign(contract, operator, oracle);
    await (await contract.connect(operator).closeCampaign(id)).wait();

    const vendorRef = ethers.keccak256(ethers.toUtf8Bytes("vendor-1"));
    const utrHash = ethers.keccak256(ethers.toUtf8Bytes("utr-1"));
    const donorRef = ethers.keccak256(ethers.toUtf8Bytes("donor-1"));

    await expect(
      contract.connect(oracle).attestDonation(id, utrHash, donorRef, 100n)
    ).to.be.revertedWith("inactive");

    await expect(
      contract.connect(operator).attestSpend(id, ethers.ZeroHash, vendorRef, 100n, CATEGORY.FOOD, "cid", "memo")
    ).to.be.revertedWith("inactive");

    await expect(contract.connect(operator).attestDelivery(id, ethers.ZeroHash)).to.be.revertedWith("inactive");
  });

  it("computes spendRef deterministically as keccak256(id, vendorRef, amountPaise, ts)", async () => {
    const { contract, operator, oracle } = await deployFixture();
    const id = await createCampaign(contract, operator, oracle);
    const vendorRef = ethers.keccak256(ethers.toUtf8Bytes("vendor-1"));

    const tx = await contract
      .connect(operator)
      .attestSpend(id, ethers.ZeroHash, vendorRef, 18400n, CATEGORY.FOOD, "cid", "memo");
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    const expected = ethers.keccak256(
      ethers.solidityPacked(["uint256", "bytes32", "uint256", "uint256"], [id, vendorRef, 18400n, block!.timestamp])
    );

    const event = receipt!.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === "SpendAttested");

    expect(event!.args.spendRef).to.equal(expected);
  });

  it("fuzzes amountPaise bounds without overflow/revert for donations and spends", async () => {
    const { contract, operator, oracle } = await deployFixture();
    const id = await createCampaign(contract, operator, oracle);
    const vendorRef = ethers.keccak256(ethers.toUtf8Bytes("vendor-1"));
    const amounts = [0n, 1n, 100n, 12345678901n, ethers.MaxUint256 / 4n];

    for (const amount of amounts) {
      await (await contract.connect(oracle).attestDonation(id, ethers.ZeroHash, ethers.ZeroHash, amount)).wait();
      await (
        await contract.connect(operator).attestSpend(id, ethers.ZeroHash, vendorRef, amount, CATEGORY.FOOD, "cid", "memo")
      ).wait();
    }
  });

  it("never exposes payable, receive/fallback, transfer/send/call{value:}, or ERC-20 surface", () => {
    const rawSource = fs.readFileSync(path.join(__dirname, "..", "contracts", "ReliefTraceIN.sol"), "utf8");
    // Strip comments first: the natspec docs above intentionally *discuss*
    // these terms in prose ("no payable modifier anywhere"); the check must
    // grep actual code, not the documentation explaining why it's absent.
    const code = rawSource.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

    expect(code).to.not.match(/\bpayable\b/);
    expect(code).to.not.match(/receive\s*\(/);
    expect(code).to.not.match(/fallback\s*\(/);
    expect(code).to.not.match(/\.transfer\(/);
    expect(code).to.not.match(/\.send\(/);
    expect(code).to.not.match(/\.call\{\s*value\s*:/);
    expect(code.toLowerCase()).to.not.match(/erc-?20/);
  });
});
