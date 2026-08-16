import { notFound } from "next/navigation";
import { AI_REPORT_RECORD, CAMPAIGNS, RELATED_CAMPAIGNS } from "@/lib/campaigns";
import CampaignClient from "./CampaignClient";

export function generateStaticParams() {
  return Object.keys(CAMPAIGNS).map((slug) => ({ slug }));
}

export default async function CampaignPage(props: PageProps<"/campaign/[slug]">) {
  const { slug } = await props.params;
  const campaign = CAMPAIGNS[slug];
  if (!campaign) notFound();

  return <CampaignClient campaign={campaign} related={RELATED_CAMPAIGNS} aiRecord={AI_REPORT_RECORD} />;
}
