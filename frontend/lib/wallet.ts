// Minimal MetaMask (window.ethereum) integration for the operator console.
// No ethers/wagmi dependency needed: personal_sign via window.ethereum
// produces the exact EIP-191 signature backend/src/auth/operatorSignature.ts
// verifies with ethers.verifyMessage() server-side.

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function isWalletAvailable(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

function isMobileUserAgent(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// On mobile, a regular browser tab (Safari/Chrome) never gets window.ethereum
// injected even if MetaMask is installed -- only MetaMask's own in-app
// browser injects it. The fix is to hand off to that in-app browser via
// MetaMask's universal link, which reopens the current page inside it.
function redirectToMetaMaskInAppBrowser(): void {
  const here = window.location.href.replace(/^https?:\/\//, "");
  window.location.href = `https://metamask.app.link/dapp/${here}`;
}

// Monad testnet (chain id 10143 = 0x279f), matching backend/.env.example's
// MONAD_TESTNET_* defaults. MetaMask defaults every connected site to
// whatever network it's currently pointed at (Ethereum Mainnet, most
// likely) -- there's no way around that on first connect except explicitly
// asking it to switch/add this chain, which is what produced the confusing
// "Ethereum" branding in the confirmation popup.
const MONAD_TESTNET_CHAIN_ID_HEX =
  "0x" + Number(process.env.NEXT_PUBLIC_MONAD_TESTNET_CHAIN_ID || 10143).toString(16);
const MONAD_TESTNET_PARAMS = {
  chainId: MONAD_TESTNET_CHAIN_ID_HEX,
  chainName: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: [process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: [(process.env.NEXT_PUBLIC_MONAD_EXPLORER_TX_BASE_URL || "https://testnet.monadscan.com/tx").replace(/\/tx\/?$/, "")],
};

// Switches MetaMask to Monad testnet, adding it to the wallet first if it
// isn't already known there (error code 4902 is MetaMask's "unrecognized
// chain" signal for wallet_switchEthereumChain).
async function ensureMonadTestnet(): Promise<void> {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_TESTNET_CHAIN_ID_HEX }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [MONAD_TESTNET_PARAMS] });
    } else {
      throw err;
    }
  }
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    if (isMobileUserAgent()) {
      redirectToMetaMaskInAppBrowser();
      // Navigation is async; the page unloads shortly after this returns.
      throw new Error("Opening MetaMask...");
    }
    throw new Error("No wallet extension found. Install MetaMask to continue.");
  }
  const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("No account returned by the wallet.");
  await ensureMonadTestnet();
  return address;
}

// Silent check (no permission prompt): returns the already-authorized
// account if this site previously connected and MetaMask still grants it
// access, or null otherwise. Used to skip the login screen on return visits.
export async function getAuthorizedAccount(): Promise<string | null> {
  if (!window.ethereum) return null;
  const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
  return accounts?.[0] ?? null;
}

// MetaMask emits "accountsChanged" ([]) on disconnect/lock and ([addr]) on
// account switch. Returns an unsubscribe function.
export function onAccountsChanged(handler: (accounts: string[]) => void): () => void {
  if (!window.ethereum?.on) return () => {};
  const listener = (...args: unknown[]) => handler(args[0] as string[]);
  window.ethereum.on("accountsChanged", listener);
  return () => window.ethereum?.removeListener?.("accountsChanged", listener);
}

async function signMessageWithWallet(address: string, message: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error("No wallet extension found. Install MetaMask to continue.");
  }
  return (await window.ethereum.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;
}

export type OperatorAuth = {
  authAddress: string;
  authNonce: string;
  authTimestamp: number;
  authSignature: string;
};

// Mirrors backend/src/auth/operatorSignature.ts's buildCanonicalMessage
// exactly: `${route}:${campaignId ?? ""}:${nonce}:${timestamp}`. `route` must
// be the literal path-template string the backend checks against (e.g.
// "POST /api/campaigns/:id/spend"), not the resolved URL.
export async function signOperatorRequest(
  address: string,
  route: string,
  campaignId: number | null
): Promise<OperatorAuth> {
  await ensureMonadTestnet();
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const message = `${route}:${campaignId ?? ""}:${nonce}:${timestamp}`;
  const authSignature = await signMessageWithWallet(address, message);
  return { authAddress: address, authNonce: nonce, authTimestamp: timestamp, authSignature };
}
