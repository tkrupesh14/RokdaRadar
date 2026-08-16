// Produces a valid signed request for the operator-signature-gated routes
// (POST /api/campaigns, POST /api/campaigns/:id/spend, POST .../deliver),
// since there is no frontend wallet UI yet at MVP0. Use it to hand-build
// requests to exercise from Swagger UI or curl.
//
// Usage:
//   npx tsx scripts/signOperatorRequest.ts <privateKey> "<route>" [campaignId]
//
// Example:
//   npx tsx scripts/signOperatorRequest.ts 0xabc... "POST /api/campaigns"
//   npx tsx scripts/signOperatorRequest.ts 0xabc... "POST /api/campaigns/:id/spend" 1
import { ethers } from "ethers";
import { buildCanonicalMessage } from "../src/auth/operatorSignature.js";

async function main() {
  const [privateKey, route, campaignIdArg] = process.argv.slice(2);
  if (!privateKey || !route) {
    console.error('Usage: tsx scripts/signOperatorRequest.ts <privateKey> "<route>" [campaignId]');
    process.exitCode = 1;
    return;
  }

  const campaignId = campaignIdArg ? Number(campaignIdArg) : null;
  const wallet = new ethers.Wallet(privateKey);
  const nonce = ethers.hexlify(ethers.randomBytes(16));
  const timestamp = Date.now();

  const message = buildCanonicalMessage(route, campaignId, nonce, timestamp);
  const signature = await wallet.signMessage(message);

  console.log(
    JSON.stringify(
      { address: wallet.address, nonce, timestamp, signature },
      null,
      2
    )
  );
}

main();
