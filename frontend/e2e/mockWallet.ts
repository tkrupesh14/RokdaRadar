import type { Page } from "@playwright/test";

// Injects a minimal fake EIP-1193 provider as window.ethereum before any
// page script runs, so lib/wallet.ts's connectWallet()/signOperatorRequest()
// talk to this instead of trying to reach a real extension. Good enough for
// a smoke test: it answers exactly the RPC calls the operator console
// actually makes (eth_requestAccounts, eth_accounts, wallet_switchEthereumChain,
// personal_sign) and nothing else.
export async function mockInjectedWallet(page: Page, address = "0x1111111111111111111111111111111111111111") {
  await page.addInitScript((addr) => {
    // A real wallet only returns an account from eth_accounts once the site
    // has been granted access via a prior eth_requestAccounts -- eth_accounts
    // stays [] before that. Mirroring that here matters: the operator page
    // calls getAuthorizedAccount() (-> eth_accounts) on mount to silently
    // skip the login screen on return visits, so if this mock returned the
    // address for eth_accounts unconditionally, every test would already be
    // "logged in" before ever clicking Connect wallet.
    let connected = false;
    (window as unknown as { ethereum: unknown }).ethereum = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        switch (method) {
          case "eth_requestAccounts":
            connected = true;
            return [addr];
          case "eth_accounts":
            return connected ? [addr] : [];
          case "wallet_switchEthereumChain":
            return null;
          case "personal_sign":
            return "0x" + "0".repeat(130);
          default:
            throw new Error(`mockInjectedWallet: unhandled method ${method}`);
        }
      },
      on: () => {},
      removeListener: () => {},
    };
  }, address);
}
