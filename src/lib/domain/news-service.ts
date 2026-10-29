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

const DEFAULT_INITIAL_NEWS: NewsPostItem[] = [
  {
    id: 8101,
    title: "Phát động Vòng Sơ khảo Mùa 2",
    summary: "Ban Tổ chức UTT",
    content:
      'Chính thức phát động Vòng Sơ khảo "Thử thách Sáng tạo 4.0 UTT — Mùa 2"\n• Cấp mã hồ sơ tự động TTST-02-XX ngay khi nộp.\n• Mở tính năng ghép nhóm liên khoa tại Hội chợ ý tưởng.\n• Tiếp nhận giải pháp cho các bài toán đặt hàng từ Khoa/Viện.',
    category: "THONG_BAO",
    author: "Quản trị viên BTC",
    isPinned: true,
    status: "PUBLISHED",
    imageUrl: "/images/traffic-ai.webp",
    thumbLabel: "Thể lệ Mùa 2",
    createdAt: "2026-10-28T08:00:00.000Z",
    updatedAt: "2026-10-28T08:00:00.000Z",
  },
  {
    id: 8102,
    title: "Workshop Kỹ năng viết Đề cương",
    summary: "Sự kiện • 26/10/2026 • Hội trường UTT",
    content:
      "Buổi tập huấn chuyên sâu hướng dẫn sinh viên cách trình bày mô tả bài toán, tính mới công nghệ và phương án triển khai thực tế để đạt điểm tối đa tại Vòng Sơ khảo.\n• Diễn giả: Hội đồng Cố vấn Khoa học & Công nghệ UTT.\n• Hỗ trợ giải đáp trực tiếp 1-1 cho các nhóm nghiên cứu.",
    category: "SU_KIEN",
    author: "Ban Cố vấn UTT",
    isPinned: false,
    status: "PUBLISHED",
    imageUrl: "/images/robot.webp",
    thumbLabel: "Lịch Workshop",
    createdAt: "2026-10-26T09:00:00.000Z",
    updatedAt: "2026-10-26T09:00:00.000Z",
  },
  {
    id: 8103,
    title: "5 tiêu chí chấm chọn ý tưởng 4.0",
    summary: "Cố vấn chuyên môn • Hội đồng GK",
    content:
      "Hội đồng Giám khảo công bố 5 tiêu chí trọng tâm đánh giá hồ sơ đề tài Mùa 2:\n• Tính cấp thiết và khả năng giải quyết bài toán thực tiễn.\n• Mức độ ứng dụng công nghệ số, AI, IoT hoặc Tự động hóa.\n• Tính khả thi khi ươm tạo và chuyển giao tại UTT.",
    category: "VINH_DANH",
    author: "Hội đồng Giám khảo",
    isPinned: false,
    status: "PUBLISHED",
    imageUrl: "/images/vr.webp",
    thumbLabel: "Tiêu chí GK",
    createdAt: "2026-10-25T10:00:00.000Z",
    updatedAt: "2026-10-25T10:00:00.000Z",
  },
  {
    id: 8104,
    title: "Đặt hàng bài toán thực tế từ Doanh nghiệp",
    summary: "Sảnh nhiệm vụ • Kèm kinh phí tài trợ",
    content:
      "Các Khoa, Viện và Doanh nghiệp đối tác của UTT liên tục cập nhật các bài toán đặt hàng thực tế tại Sảnh nhiệm vụ.\n• Các đội thi giải quyết bài toán đặt hàng được ưu tiên hỗ trợ kinh phí ươm tạo.\n• Kết nối cố vấn chuyên môn đồng hành xuyên suốt mùa giải.",
    category: "THONG_BAO",
    author: "Quản trị viên BTC",
    isPinned: false,
    status: "PUBLISHED",
    imageUrl: "/images/parking.webp",
    thumbLabel: "Đặt hàng DN",
    createdAt: "2026-10-24T08:30:00.000Z",
    updatedAt: "2026-10-24T08:30:00.000Z",
  },
];

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
      await saveNewsIndex(DEFAULT_INITIAL_NEWS);
      return sortNewsPosts(DEFAULT_INITIAL_NEWS);
    }
    const parsed = JSON.parse(row.label);
    if (!Array.isArray(parsed)) {
      return sortNewsPosts(DEFAULT_INITIAL_NEWS);
    }
    return sortNewsPosts(parsed as NewsPostItem[]);
  } catch {
    return sortNewsPosts(DEFAULT_INITIAL_NEWS);
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
