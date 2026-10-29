import { AwardDetailView } from "@/components/views/award-detail-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chi tiết giải thưởng – UTT Innovation Portal",
};

export default async function PublicAwardDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <AwardDetailView slug={slug} />;
}
