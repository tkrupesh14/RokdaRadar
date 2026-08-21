// Wallet integration for the operator console: window.ethereum (MetaMask
// extension, or MetaMask's own in-app browser) on desktop, and WalletConnect
// on mobile browsers that have no injected provider. Either way we end up
// with an EIP-1193 `request()` provider; personal_sign through it produces
// the exact EIP-191 signature backend/src/auth/operatorSignature.ts verifies
// with ethers.verifyMessage() server-side.

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

// Monad testnet (chain id 10143 = 0x279f), matching backend/.env.example's
// MONAD_TESTNET_* defaults. MetaMask defaults every connected site to
// whatever network it's currently pointed at (Ethereum Mainnet, most
// likely) -- there's no way around that on first connect except explicitly
// asking it to switch/add this chain, which is what produced the confusing
// "Ethereum" branding in the confirmation popup.
const MONAD_TESTNET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_MONAD_TESTNET_CHAIN_ID || 10143);
const MONAD_TESTNET_CHAIN_ID_HEX = "0x" + MONAD_TESTNET_CHAIN_ID.toString(16);
const MONAD_TESTNET_RPC_URL = process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz";
const MONAD_TESTNET_PARAMS = {
  chainId: MONAD_TESTNET_CHAIN_ID_HEX,
  chainName: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: [MONAD_TESTNET_RPC_URL],
  blockExplorerUrls: [(process.env.NEXT_PUBLIC_MONAD_EXPLORER_TX_BASE_URL || "https://testnet.monadscan.com/tx").replace(/\/tx\/?$/, "")],
};

// The provider actually in use for this session: the injected extension
// when present, otherwise a WalletConnect session (mobile browsers with no
// injected window.ethereum). Everything below talks to whichever is active
// through the same EIP-1193 request() shape, so callers don't need to care.
let activeProvider: Eip1193Provider | null = null;
let wcProviderPromise: Promise<Eip1193Provider> | null = null;

// Lazy-loaded: pulls in WalletConnect's relay/modal code only when actually
// needed (mobile browser, no injected wallet), not on every page load.
async function getWalletConnectProvider(): Promise<Eip1193Provider> {
  if (!wcProviderPromise) {
    wcProviderPromise = (async () => {
      const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      if (!projectId) {
        throw new Error("Wallet connect is not configured (missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID).");
      }
      const provider = await EthereumProvider.init({
        projectId,
        chains: [MONAD_TESTNET_CHAIN_ID],
        rpcMap: { [MONAD_TESTNET_CHAIN_ID]: MONAD_TESTNET_RPC_URL },
        showQrModal: true,
        metadata: {
          name: "RokdaRadar Operator",
          description: "RokdaRadar operator console",
          url: typeof window !== "undefined" ? window.location.origin : "https://rokdaradar.app",
          icons: [],
        },
      });
      return provider as unknown as Eip1193Provider;
    })();
  }
  return wcProviderPromise;
}

export function isWalletAvailable(): boolean {
  // WalletConnect is always an option (it shows its own connect UI), so the
  // "connect" button should never be hidden -- only the injected-only check
  // used to gate it.
  return true;
}

// Switches the active wallet to Monad testnet, adding it first if it isn't
// already known there (error code 4902 is the standard "unrecognized chain"
// signal for wallet_switchEthereumChain, from both MetaMask and WalletConnect
// wallets).
async function ensureMonadTestnet(): Promise<void> {
  if (!activeProvider) return;
  try {
    await activeProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_TESTNET_CHAIN_ID_HEX }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await activeProvider.request({ method: "wallet_addEthereumChain", params: [MONAD_TESTNET_PARAMS] });
    } else {
      throw err;
    }
  }
}

export async function connectWallet(): Promise<string> {
  if (window.ethereum) {
    activeProvider = window.ethereum;
    const accounts = (await activeProvider.request({ method: "eth_requestAccounts" })) as string[];
    const address = accounts?.[0];
    if (!address) throw new Error("No account returned by the wallet.");
    await ensureMonadTestnet();
    return address;
  }

  // No injected provider (typical for a plain mobile browser tab): fall
  // back to WalletConnect. Its connect() deep-links out to the installed
  // wallet app for approval and then returns control to this tab on its
  // own -- the browser tab never has to navigate away.
  const provider = await getWalletConnectProvider();
  activeProvider = provider;
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("No account returned by the wallet.");
  await ensureMonadTestnet();
  return address;
}

// Silent check (no permission prompt): returns the already-authorized
// account if this site previously connected and the wallet still grants it
// access, or null otherwise. Used to skip the login screen on return visits.
export async function getAuthorizedAccount(): Promise<string | null> {
  if (window.ethereum) {
    activeProvider = window.ethereum;
    const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
    return accounts?.[0] ?? null;
  }
  // Only probe WalletConnect if a project id is configured and a session
  // was actually persisted from a prior connect -- otherwise this would
  // eagerly load the WC bundle on every page view.
  if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) return null;
  if (typeof localStorage === "undefined" || !localStorage.getItem("wc@2:client:0.3//session")) return null;
  const provider = await getWalletConnectProvider();
  activeProvider = provider;
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  return accounts?.[0] ?? null;
}

// Emits ([]) on disconnect/lock and ([addr]) on account switch, for both
// the injected extension and an active WalletConnect session. Returns an
// unsubscribe function.
export function onAccountsChanged(handler: (accounts: string[]) => void): () => void {
  const on = activeProvider?.on;
  if (!on) return () => {};
  const provider = activeProvider as Eip1193Provider;
  const listener = (...args: unknown[]) => handler(args[0] as string[]);
  on.call(provider, "accountsChanged", listener);
  return () => provider.removeListener?.("accountsChanged", listener);
}

async function signMessageWithWallet(address: string, message: string): Promise<string> {
  if (!activeProvider) {
    throw new Error("No wallet connected.");
  }
  return (await activeProvider.request({
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
