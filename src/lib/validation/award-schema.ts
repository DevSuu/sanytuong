import { z } from "zod";
import { AwardStatus, AwardSeasonStatus } from "@/generated/prisma/client";

export const awardMemberInputSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(2, "Họ và tên thành viên phải có ít nhất 2 ký tự."),
  studentCode: z.string().trim().optional().nullable(),
  className: z.string().trim().optional().nullable(),
  role: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
  displayOrder: z.number().int().default(0),
  isDemo: z.boolean().default(false),
});

export const createAwardSchema = z.object({
  seasonId: z.string().trim().min(1, "Vui lòng chọn mùa giải thưởng (Season)."),
  title: z
    .string()
    .trim()
    .min(3, "Tiêu đề giải thưởng/ý tưởng phải có ít nhất 3 ký tự.")
    .max(250, "Tiêu đề không được vượt quá 250 ký tự."),
  slug: z.string().trim().optional(),
  awardName: z
    .string()
    .trim()
    .min(2, "Tên giải thưởng đạt được phải có ít nhất 2 ký tự (ví dụ: Giải Nhất, Giải Sáng tạo)."),
  category: z.string().trim().optional().nullable(),
  organization: z.string().trim().optional().nullable(),
  shortDescription: z.string().trim().optional().nullable(),
  description: z
    .string()
    .trim()
    .min(10, "Mô tả giải thưởng/sản phẩm phải có ít nhất 10 ký tự."),
  imageUrl: z.string().trim().optional().nullable(),
  videoUrl: z.string().trim().optional().nullable(),
  displayOrder: z.number().int().default(0),
  status: z.nativeEnum(AwardStatus).default(AwardStatus.DRAFT),
  isDemo: z.boolean().default(false),
  members: z.array(awardMemberInputSchema).optional().default([]),
});

export const updateAwardSchema = z.object({
  seasonId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(3).max(250).optional(),
  slug: z.string().trim().optional(),
  awardName: z.string().trim().min(2).optional(),
  category: z.string().trim().optional().nullable(),
  organization: z.string().trim().optional().nullable(),
  shortDescription: z.string().trim().optional().nullable(),
  description: z.string().trim().min(10).optional(),
  imageUrl: z.string().trim().optional().nullable(),
  videoUrl: z.string().trim().optional().nullable(),
  displayOrder: z.number().int().optional(),
  status: z.nativeEnum(AwardStatus).optional(),
  isDemo: z.boolean().optional(),
  members: z.array(awardMemberInputSchema).optional(),
});

export const changeAwardStatusSchema = z.object({
  status: z.nativeEnum(AwardStatus),
  reason: z.string().trim().optional().nullable(),
});

export const createSeasonSchema = z.object({
  name: z.string().trim().min(2, "Tên mùa giải phải có ít nhất 2 ký tự."),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional().nullable(),
  year: z.number().int().optional().nullable(),
  status: z.nativeEnum(AwardSeasonStatus).default(AwardSeasonStatus.DRAFT),
  isDemo: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
});

export const updateSeasonSchema = z.object({
  name: z.string().trim().min(2).optional(),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional().nullable(),
  year: z.number().int().optional().nullable(),
  status: z.nativeEnum(AwardSeasonStatus).optional(),
  isDemo: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});
