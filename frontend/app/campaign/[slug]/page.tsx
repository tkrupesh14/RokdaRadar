import { notFound } from "next/navigation";
import { AI_REPORT_RECORD, CAMPAIGNS, getRelatedCampaigns } from "@/lib/campaigns";
import { overlayBackendData } from "@/lib/mergeCampaign";
import CampaignClient from "./CampaignClient";

export function generateStaticParams() {
  return Object.keys(CAMPAIGNS).map((slug) => ({ slug }));
}

export default async function CampaignPage(props: PageProps<"/campaign/[slug]">) {
  const { slug } = await props.params;
  const mock = CAMPAIGNS[slug];
  if (!mock) notFound();

  // Overlays real raised/spent/category/ledger/report data from the backend
  // when this campaign has a backendId and the backend has it (see
  // lib/mergeCampaign.ts). Silently falls back to the static mock otherwise
  // -- expected until a real on-chain campaign exists.
  const { campaign, report } = await overlayBackendData(mock);
  const related = getRelatedCampaigns(slug);

  return <CampaignClient campaign={campaign} related={related} aiRecord={AI_REPORT_RECORD} report={report} />;
}
