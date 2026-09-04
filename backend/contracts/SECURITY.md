# ReliefTraceIN.sol security review

Manual review performed for issue #17 (area:security, P1) against
`contracts/ReliefTraceIN.sol`. Covers the three items the issue asked for;
static analysis was wired into CI rather than run ad hoc (see below).

## Access control (`onlyOperator`, `onlyOracle`, `onlyActive`)

- `onlyOperator(id)` / `onlyOracle(id)` compare `msg.sender` against
  `campaigns[id].operator` / `.oracle`. For a campaign id that was never
  created (`id >= campaignCount`), the struct is zero-valued, so the stored
  address is `address(0)`. A real transaction's `msg.sender` can never be
  `address(0)`, so both modifiers correctly reject calls against
  non-existent campaigns without needing an explicit `id < campaignCount`
  check.
- `createCampaign` had no validation on the caller-supplied `oracle`
  address. Passing `address(0)` (by mistake -- there's no legitimate reason
  to do it deliberately) would pass every check at creation time and then
  permanently brick donation attestation for that campaign, since no real
  sender can ever satisfy `onlyOracle` afterwards, and there is no way to
  change a campaign's oracle post-creation. **Fixed**: `createCampaign` now
  requires `oracle != address(0)`.
- `attestDelivery` intentionally has no on-chain access control -- the
  natspec comment on that function documents that the attestor allowlist is
  enforced at the API layer for MVP0, with a real on-chain attestor
  registry deferred to MVP2+ (HLD 4.2). Reviewed and confirmed this matches
  the HLD; not a bug, just worth calling out since it's the one function
  that looks unguarded next to the others.
- **Known gap, not fixed here**: there is no way to rotate a campaign's
  `operator` or `oracle` address after creation. If either private key
  leaks, the only mitigation is abandoning the campaign (`closeCampaign`)
  -- there's no way to keep it running under a new key. That's a real
  operational gap for the key-rotation plan in `SECRETS.md` (#18), but
  adding rotation functions changes the contract's external interface and
  needs matching indexer/DB updates to stay in sync (the `campaigns.operator`
  column read by the API is populated once from `CampaignCreated` and never
  updated), so it's scoped out of this review as a follow-up rather than
  bundled in here.

## Reentrancy surface

None. No function in this contract makes an external call of any kind --
no `.call`, `.delegatecall`, `.staticcall`, and no calls into another
contract or interface. Every function only reads/writes `campaigns[id]`
storage and emits events. Documented directly on the contract (`@dev` note
above the contract declaration) so this stays visible next to the code
rather than only in this doc.

## "No payable, no transfer, no token" invariant (HLD principle #1)

Confirmed with no exceptions: no `payable` modifier on any function, no
`receive()`/`fallback()`, no `.transfer(`/`.send(`/`.call{value:`, and no
ERC-20 reference anywhere in the file. This was already enforced by a
source-grep test (`never exposes payable, receive/fallback, ... or ERC-20
surface` in `test/ReliefTraceIN.test.ts`) before this review; re-verified
it still passes and still greps the right things (the grep strips comments
first, so it can't be fooled by the natspec's own prose mentioning these
words).

## Other findings (informational, not fixed)

- `attestSpend` increments `spentPaise` with no check against
  `raisedPaise` -- an operator can attest spends that exceed the campaign's
  raised total. This reads like it could be a bug, but the anomaly-flagging
  system (`src/indexer/anomalyRules.ts`) is the actual mechanism this
  project uses for financial-integrity checks (vendor concentration, admin
  ratio, category/promise mismatch), and none of those rules currently
  cover overspend either. Whether overspend should hard-revert on-chain or
  stay a flagged-but-allowed anomaly (e.g. multi-campaign fund transfers, or
  an operator legitimately fronting costs before a donation batch clears)
  is a product decision, not a security bug -- flagging for a product
  owner to decide rather than assuming an on-chain revert is correct.
- Overflow/underflow: not reachable. Solidity 0.8.24 has built-in
  checked arithmetic on `raisedPaise`/`spentPaise`/`campaignCount`; any
  overflow reverts automatically. The existing fuzz test already exercises
  amounts up to `type(uint256).max / 4` without issue.

## Static analysis (Slither)

Slither/Mythril were not available in the environment this review ran in
(no local Python/pip toolchain, and installing one wasn't in scope for a
one-off check). Instead of skipping this requirement, wired a
`contracts-security` job into `.github/workflows/pr-checks.yml` that
compiles the contract, runs the existing Hardhat test suite, and runs
`crytic/slither-action` against `backend/contracts` on every PR. It's
`continue-on-error: true` for now since this is its first run and any
findings need a human triage pass before they can safely gate merges --
tighten that once the initial run's findings are resolved or explicitly
accepted as non-issues.

## Recommendation

Per the issue's own ask: before mainnet or high-value testnet usage, get
an independent third-party audit. This review is a thorough manual pass
plus CI-wired static analysis, not a substitute for one -- the contract is
small (143 lines) and the invariants held up, but an external audit is
still the right bar before real money-adjacent attestations are load-bearing
at scale.
