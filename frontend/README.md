# ReliefTrace — frontend

A [Next.js](https://nextjs.org) (App Router, TypeScript) implementation of the ReliefTrace product surfaces, built from the
`scoping-form-responses` HTML/CSS prototypes exported by Claude Design.

ReliefTrace is a transparency layer for disaster relief donations: money moves via UPI as it always has, and only the
proof — every receipt, every rupee spent — is recorded on Monad. No cryptocurrency changes hands.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the donor-facing landing page.

## Pages

| Route | Purpose | Linked from |
| --- | --- | --- |
| `/` | Public landing page — product pitch, live stats, how-it-works, FAQ | Nav on every public page |
| `/campaign/[slug]` | Campaign detail — story, category breakdown, AI report, full spend ledger, updates, donors, trust score. Seeded with `wayanad-landslide-relief-fund` | Landing page, nav |
| `/campaign/[slug]/donate` | Three-beat UPI donation flow — pick amount, pay by QR, receipt with transaction proof | Campaign page sidebar |
| `/operator` | Field-operator console — PIN login, record a spend with evidence, recent spend feed | Footer (internal tools) |
| `/csr` | CSR compliance dashboard — portfolio summary, charts, filterable campaign grid, board report modal | Footer (internal tools) |
| `/csr/admin` | CSR team & campaign admin — create campaigns, add/assign operators, view operator progress | CSR dashboard header |
| `/arena` | "Arena Mode" — a fictional, self-playing demo of the fraud-detection pipeline (its own bold visual style, distinct from the main design system) | Footer (internal tools) |

All mock data (campaigns, ledgers, operators, CSR portfolio) lives in `lib/` and is currently static/in-memory —
there is no backend integration yet. Interactive pages (donation flow, operator console, CSR dashboard/admin, arena)
are client components that hold their state locally.

## Folder structure

```
app/
  layout.tsx              Root layout — loads the Organic design system fonts (Caprasimo/Figtree)
  globals.css              Design-system tokens + component classes (buttons, cards, tags, tables, dialogs, forms)
  page.tsx                 Landing page
  campaign/[slug]/
    page.tsx                Campaign detail (server) + CampaignClient.tsx (interactive parts: tx-proof modal)
    donate/
      page.tsx               Donate flow (server) + DonateClient.tsx (the 3-beat flow)
  operator/page.tsx        Operator console
  csr/
    page.tsx                CSR compliance dashboard
    admin/page.tsx          CSR team & campaign admin
  arena/
    layout.tsx              Loads Arena Mode's own fonts (Poppins/JetBrains Mono/Inter)
    page.tsx                 Arena Mode demo
components/
  Nav.tsx, Footer.tsx       Shared site chrome for public pages
  TxModal.tsx               Shared "transaction proof" dialog
  ImagePlaceholder.tsx      Placeholder for photo/map slots (no real imagery in the prototypes)
lib/
  campaigns.ts              Campaign detail + related-campaign mock data
  csrData.ts                CSR portfolio, operators, campaign-choice mock data
  format.ts                 fmtINR() — ₹ currency formatting shared across pages
```

## Design system

The visual language ("Organic") is ported into `app/globals.css` as CSS custom properties (color ramps, spacing,
radii, shadows) plus reusable component classes (`.btn`, `.card`, `.tag`, `.input`, `.table`, `.dialog`, `.nav`, …).
Headings use Caprasimo, body text uses Figtree, both loaded via `next/font/google` in `app/layout.tsx`. Arena Mode is
an intentional exception — it's a separate "fictional demo" surface with its own Poppins/Inter/JetBrains Mono look.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
