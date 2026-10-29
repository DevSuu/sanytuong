import { TaskDetailView } from "@/components/views/task-detail-view";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <TaskDetailView slug={slug} />;
}
