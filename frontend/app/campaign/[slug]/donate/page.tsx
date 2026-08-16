import { notFound } from "next/navigation";
import { CAMPAIGNS } from "@/lib/campaigns";
import DonateClient from "./DonateClient";

export function generateStaticParams() {
  return Object.keys(CAMPAIGNS).map((slug) => ({ slug }));
}

export default async function DonatePage(props: PageProps<"/campaign/[slug]/donate">) {
  const { slug } = await props.params;
  const campaign = CAMPAIGNS[slug];
  if (!campaign) notFound();

  return <DonateClient campaign={campaign} />;
}
