import { getDb } from "@/lib/db";

const TASK_IMAGES_INDEX_PROBE_ID = 9500;
const TASK_IMAGE_MIN_ID = 9501;
const TASK_IMAGE_MAX_ID = 9899;

export interface TaskImageMeta {
  probeId: number;
  updatedAt: string;
}

export type TaskImageMap = Record<string, TaskImageMeta>;

export async function getTaskImageMap(): Promise<TaskImageMap> {
  const db = getDb();
  try {
    const row = await db.systemProbe.findUnique({
      where: { id: TASK_IMAGES_INDEX_PROBE_ID },
    });
    if (!row?.label) return {};
    const parsed = JSON.parse(row.label);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as TaskImageMap;
  } catch {
    return {};
  }
}

async function saveTaskImageMap(map: TaskImageMap): Promise<void> {
  const db = getDb();
  const payload = JSON.stringify(map);
  await db.systemProbe.upsert({
    where: { id: TASK_IMAGES_INDEX_PROBE_ID },
    update: { label: payload },
    create: { id: TASK_IMAGES_INDEX_PROBE_ID, label: payload },
  });
}

export async function setTaskImage(
  taskId: string,
  imageUrl: string | null | undefined
): Promise<void> {
  if (imageUrl === undefined) return;
  const db = getDb();
  const map = await getTaskImageMap();
  const clean = (imageUrl || "").trim();

  if (!clean) {
    const existing = map[taskId];
    if (existing) {
      delete map[taskId];
      await saveTaskImageMap(map);
      await db.systemProbe.delete({ where: { id: existing.probeId } }).catch(() => {});
    }
    return;
  }

  let probeId = map[taskId]?.probeId;
  if (!probeId) {
    const usedIds = new Set(Object.values(map).map((m) => m.probeId));
    probeId = TASK_IMAGE_MIN_ID;
    while (usedIds.has(probeId) && probeId <= TASK_IMAGE_MAX_ID) {
      probeId++;
    }
    if (probeId > TASK_IMAGE_MAX_ID) {
      return;
    }
  }

  await db.systemProbe.upsert({
    where: { id: probeId },
    update: { label: clean },
    create: { id: probeId, label: clean },
  });

  map[taskId] = {
    probeId,
    updatedAt: new Date().toISOString(),
  };

  await saveTaskImageMap(map);
}

export async function deleteTaskImage(taskId: string): Promise<void> {
  await setTaskImage(taskId, null);
}

export async function getTaskRawImage(taskId: string): Promise<string | null> {
  const map = await getTaskImageMap();
  const meta = map[taskId];
  if (!meta) return null;

  const db = getDb();
  const row = await db.systemProbe.findUnique({
    where: { id: meta.probeId },
  });
  return row?.label || null;
}

export function resolveTaskDefaultImage(category?: string | null, slug?: string): string {
  const text = `${category || ""} ${slug || ""}`.toLowerCase();
  if (text.includes("giao thông") || text.includes("traffic") || text.includes("parking") || text.includes("do-xe")) {
    return "/images/parking.webp";
  }
  if (text.includes("môi trường") || text.includes("năng lượng") || text.includes("xanh") || text.includes("rac-thai")) {
    return "/images/solar.webp";
  }
  if (text.includes("ai") || text.includes("phần mềm") || text.includes("số") || text.includes("cntt")) {
    return "/images/vr.webp";
  }
  return "/images/robot.webp";
}

export function resolvePublicTaskImageUrl(
  task: { id: string; slug: string; category?: string | null },
  map: TaskImageMap
): string {
  const meta = map[task.id];
  if (meta) {
    return `/api/tasks/${task.slug}/image?t=${encodeURIComponent(meta.updatedAt)}`;
  }
  return resolveTaskDefaultImage(task.category, task.slug);
}
