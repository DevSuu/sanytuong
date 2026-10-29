import { getDb } from "@/lib/db";
import { encodePublicId } from "@/lib/security/public-id";

const HIGHLIGHTS_INDEX_PROBE_ID = 9100;
const HIGHLIGHTS_ITEM_MIN_ID = 9101;
const HIGHLIGHTS_ITEM_MAX_ID = 9899;

export interface HighlightMetaItem {
  id: number;
  title?: string;
  createdAt: string;
}

export interface PublicHighlightItem {
  id: string;
  imageUrl: string;
  title?: string;
  source: "custom" | "default";
}

const DEFAULT_FALLBACK_HIGHLIGHTS: PublicHighlightItem[] = [
  {
    id: "default-1",
    imageUrl: "/images/traffic-ai.webp",
    title: "Dấu ấn Thử thách Sáng tạo 4.0",
    source: "default",
  },
  {
    id: "default-2",
    imageUrl: "/images/robot.webp",
    title: "Dấu ấn Thử thách Sáng tạo 4.0",
    source: "default",
  },
  {
    id: "default-3",
    imageUrl: "/images/vr.webp",
    title: "Dấu ấn Thử thách Sáng tạo 4.0",
    source: "default",
  },
  {
    id: "default-4",
    imageUrl: "/images/solar.webp",
    title: "Dấu ấn Thử thách Sáng tạo 4.0",
    source: "default",
  },
];

export async function getCustomHighlightsIndex(): Promise<HighlightMetaItem[]> {
  const db = getDb();
  try {
    const row = await db.systemProbe.findUnique({
      where: { id: HIGHLIGHTS_INDEX_PROBE_ID },
    });
    if (!row?.label) return [];
    const parsed = JSON.parse(row.label);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is HighlightMetaItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "number" &&
        item.id >= HIGHLIGHTS_ITEM_MIN_ID &&
        item.id <= HIGHLIGHTS_ITEM_MAX_ID
    );
  } catch {
    return [];
  }
}

async function saveCustomHighlightsIndex(items: HighlightMetaItem[]): Promise<void> {
  const db = getDb();
  const payload = JSON.stringify(items);
  await db.systemProbe.upsert({
    where: { id: HIGHLIGHTS_INDEX_PROBE_ID },
    update: { label: payload },
    create: { id: HIGHLIGHTS_INDEX_PROBE_ID, label: payload },
  });
}

export async function addCustomHighlights(
  inputs: { dataUrl: string; title?: string }[]
): Promise<HighlightMetaItem[]> {
  const db = getDb();
  const current = await getCustomHighlightsIndex();
  const usedIds = new Set(current.map((i) => i.id));

  const nextItems = [...current];

  for (const input of inputs) {
    const raw = (input.dataUrl || "").trim();
    if (!raw.startsWith("data:image/") && !raw.startsWith("/") && !raw.startsWith("http")) {
      continue;
    }

    // Find next available ID in 9101..9899
    let nextId = HIGHLIGHTS_ITEM_MIN_ID;
    while (usedIds.has(nextId) && nextId <= HIGHLIGHTS_ITEM_MAX_ID) {
      nextId++;
    }
    if (nextId > HIGHLIGHTS_ITEM_MAX_ID) break;

    usedIds.add(nextId);

    await db.systemProbe.upsert({
      where: { id: nextId },
      update: { label: raw },
      create: { id: nextId, label: raw },
    });

    nextItems.push({
      id: nextId,
      title: input.title?.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
  }

  await saveCustomHighlightsIndex(nextItems);
  return nextItems;
}

export async function deleteCustomHighlight(id: number): Promise<HighlightMetaItem[]> {
  const db = getDb();
  const current = await getCustomHighlightsIndex();
  const filtered = current.filter((item) => item.id !== id);

  await saveCustomHighlightsIndex(filtered);
  await db.systemProbe
    .delete({
      where: { id },
    })
    .catch(() => {});

  return filtered;
}

export async function getCustomHighlightRawImage(id: number): Promise<string | null> {
  if (id < HIGHLIGHTS_ITEM_MIN_ID || id > HIGHLIGHTS_ITEM_MAX_ID) return null;
  const db = getDb();
  const row = await db.systemProbe.findUnique({
    where: { id },
  });
  return row?.label || null;
}

export async function getPublicHighlights(): Promise<PublicHighlightItem[]> {
  const customIndex = await getCustomHighlightsIndex();

  const customItems: PublicHighlightItem[] = customIndex.map((item) => {
    const publicUuid = encodePublicId(item.id, "hl");
    return {
      id: publicUuid,
      imageUrl: `/api/highlights/${publicUuid}/image?w=564&t=${encodeURIComponent(item.createdAt)}`,
      title: item.title,
      source: "custom",
    };
  });

  if (customItems.length > 0) {
    return customItems;
  }

  return DEFAULT_FALLBACK_HIGHLIGHTS;
}
