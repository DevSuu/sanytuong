import { getDb } from "@/lib/db";
import { encodePublicId } from "@/lib/security/public-id";

const NEWS_INDEX_PROBE_ID = 8100;
const NEWS_ITEM_MIN_ID = 8101;
const NEWS_ITEM_MAX_ID = 8899;

export type NewsCategory = "THONG_BAO" | "SU_KIEN" | "VINH_DANH";
export type NewsStatus = "PUBLISHED" | "DRAFT";

export const NEWS_CATEGORY_META: Record<
  NewsCategory,
  { label: string; shortLabel: string; color: string }
> = {
  THONG_BAO: {
    label: "Thông Báo BTC",
    shortLabel: "Thông Báo",
    color: "#dc2626",
  },
  SU_KIEN: {
    label: "Sự Kiện & Workshop",
    shortLabel: "Sự Kiện",
    color: "#2563eb",
  },
  VINH_DANH: {
    label: "Vinh Danh & Cố Vấn",
    shortLabel: "Cố Vấn",
    color: "#16a34a",
  },
};

export interface NewsPostItem {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: NewsCategory;
  author: string;
  isPinned: boolean;
  status: NewsStatus;
  imageUrl: string;
  thumbLabel?: string;
  createdAt: string;
  updatedAt: string;
}

function sortNewsPosts(items: NewsPostItem[]): NewsPostItem[] {
  return [...items].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

async function saveNewsIndex(items: NewsPostItem[]): Promise<void> {
  const db = getDb();
  const payload = JSON.stringify(items);
  await db.systemProbe.upsert({
    where: { id: NEWS_INDEX_PROBE_ID },
    update: { label: payload },
    create: { id: NEWS_INDEX_PROBE_ID, label: payload },
  });
}

export async function getAdminNewsPosts(): Promise<NewsPostItem[]> {
  const db = getDb();
  try {
    const row = await db.systemProbe.findUnique({
      where: { id: NEWS_INDEX_PROBE_ID },
    });
    if (!row?.label) {
      return [];
    }
    const parsed = JSON.parse(row.label);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sortNewsPosts(parsed as NewsPostItem[]);
  } catch {
    return [];
  }
}

export async function getPublicNewsPosts(): Promise<NewsPostItem[]> {
  const all = await getAdminNewsPosts();
  return all
    .filter((item) => item.status === "PUBLISHED")
    .map((item) => {
      let imageUrl = item.imageUrl;
      if (imageUrl.startsWith("/api/news/")) {
        const publicUuid = encodePublicId(item.id, "news");
        imageUrl = `/api/news/${publicUuid}/image?w=680&t=${encodeURIComponent(item.updatedAt || item.createdAt)}`;
      } else if (imageUrl === "/images/robot.jpg") {
        imageUrl = "/images/robot.webp";
      } else if (imageUrl === "/images/vr.jpg") {
        imageUrl = "/images/vr.webp";
      } else if (imageUrl === "/images/parking.jpg") {
        imageUrl = "/images/parking.webp";
      } else if (imageUrl === "/images/solar.jpg") {
        imageUrl = "/images/solar.webp";
      }
      return {
        ...item,
        imageUrl,
      };
    });
}

export async function createNewsPost(input: {
  title: string;
  summary?: string;
  content: string;
  category?: NewsCategory;
  author?: string;
  isPinned?: boolean;
  status?: NewsStatus;
  imageDataUrl?: string;
  thumbLabel?: string;
}): Promise<NewsPostItem> {
  const db = getDb();
  const current = await getAdminNewsPosts();
  const usedIds = new Set(current.map((i) => i.id));

  let nextId = NEWS_ITEM_MIN_ID;
  while (usedIds.has(nextId) && nextId <= NEWS_ITEM_MAX_ID) {
    nextId++;
  }
  if (nextId > NEWS_ITEM_MAX_ID) {
    throw new Error("Đã đạt giới hạn số lượng bản tin lưu trữ.");
  }

  const now = new Date().toISOString();
  let imageUrl = "/images/traffic-ai.webp";

  const rawImg = (input.imageDataUrl || "").trim();
  if (rawImg.startsWith("data:image/")) {
    await db.systemProbe.upsert({
      where: { id: nextId },
      update: { label: rawImg },
      create: { id: nextId, label: rawImg },
    });
    const publicUuid = encodePublicId(nextId, "news");
    imageUrl = `/api/news/${publicUuid}/image?w=680&t=${encodeURIComponent(now)}`;
  } else if (rawImg.startsWith("/") || rawImg.startsWith("http")) {
    imageUrl = rawImg;
  }

  const category: NewsCategory =
    input.category && input.category in NEWS_CATEGORY_META
      ? input.category
      : "THONG_BAO";

  const newItem: NewsPostItem = {
    id: nextId,
    title: input.title.trim(),
    summary:
      input.summary?.trim() ||
      `${NEWS_CATEGORY_META[category].shortLabel} • Ban Tổ chức UTT`,
    content: input.content.trim(),
    category,
    author: input.author?.trim() || "Quản trị viên BTC",
    isPinned: Boolean(input.isPinned),
    status: input.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
    imageUrl,
    thumbLabel: input.thumbLabel?.trim() || input.title.trim().slice(0, 18),
    createdAt: now,
    updatedAt: now,
  };

  const nextList = [newItem, ...current];
  await saveNewsIndex(nextList);
  return newItem;
}

export async function updateNewsPost(
  id: number,
  input: {
    title?: string;
    summary?: string;
    content?: string;
    category?: NewsCategory;
    author?: string;
    isPinned?: boolean;
    status?: NewsStatus;
    imageDataUrl?: string;
    thumbLabel?: string;
  }
): Promise<NewsPostItem | null> {
  const db = getDb();
  const current = await getAdminNewsPosts();
  const idx = current.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const existing = current[idx];
  const now = new Date().toISOString();
  let imageUrl = existing.imageUrl;

  if (typeof input.imageDataUrl === "string" && input.imageDataUrl.trim().length > 0) {
    const rawImg = input.imageDataUrl.trim();
    if (rawImg.startsWith("data:image/")) {
      await db.systemProbe.upsert({
        where: { id },
        update: { label: rawImg },
        create: { id, label: rawImg },
      });
      const publicUuid = encodePublicId(id, "news");
      imageUrl = `/api/news/${publicUuid}/image?w=680&t=${encodeURIComponent(now)}`;
    } else if (rawImg.startsWith("/") || rawImg.startsWith("http")) {
      imageUrl = rawImg;
    }
  }

  const updated: NewsPostItem = {
    ...existing,
    title: typeof input.title === "string" ? input.title.trim() : existing.title,
    summary: typeof input.summary === "string" ? input.summary.trim() : existing.summary,
    content: typeof input.content === "string" ? input.content.trim() : existing.content,
    category:
      input.category && input.category in NEWS_CATEGORY_META
        ? input.category
        : existing.category,
    author: typeof input.author === "string" ? input.author.trim() : existing.author,
    isPinned: typeof input.isPinned === "boolean" ? input.isPinned : existing.isPinned,
    status:
      input.status === "PUBLISHED" || input.status === "DRAFT"
        ? input.status
        : existing.status,
    imageUrl,
    thumbLabel:
      typeof input.thumbLabel === "string"
        ? input.thumbLabel.trim()
        : existing.thumbLabel,
    updatedAt: now,
  };

  const nextList = [...current];
  nextList[idx] = updated;
  await saveNewsIndex(nextList);
  return updated;
}

export async function deleteNewsPost(id: number): Promise<NewsPostItem[]> {
  const db = getDb();
  const current = await getAdminNewsPosts();
  const filtered = current.filter((i) => i.id !== id);
  await saveNewsIndex(filtered);
  await db.systemProbe
    .delete({
      where: { id },
    })
    .catch(() => {});
  return sortNewsPosts(filtered);
}

export async function getNewsPostRawImage(id: number): Promise<string | null> {
  if (id < NEWS_ITEM_MIN_ID || id > NEWS_ITEM_MAX_ID) return null;
  const db = getDb();
  const row = await db.systemProbe.findUnique({
    where: { id },
  });
  return row?.label || null;
}
