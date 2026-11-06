import { z } from "zod";
import { TaskStatus, MemberType } from "@/generated/prisma/client";
import { createSmartEmailSchema } from "./email-validator";

export const memberItemSchema = z.object({
  id: z.string().optional(),
  memberType: z.enum([MemberType.STUDENT, MemberType.ADVISOR], {
    message: "Loại thành viên phải là Sinh viên (STUDENT) hoặc GVHD (ADVISOR).",
  }),
  isLeader: z.boolean().default(false),
  fullName: z
    .string()
    .trim()
    .min(2, "Họ và tên thành viên phải có ít nhất 2 ký tự.")
    .max(100, "Họ và tên không được vượt quá 100 ký tự."),
  studentCode: z
    .string()
    .trim()
    .nullable()
    .optional(),
  className: z
    .string()
    .trim()
    .max(50, "Tên lớp không hợp lệ.")
    .nullable()
    .optional(),
  email: createSmartEmailSchema("Email thành viên không đúng định dạng."),
  phone: z
    .string()
    .trim()
    .max(20, "Số điện thoại không hợp lệ.")
    .nullable()
    .optional(),
  department: z
    .string()
    .trim()
    .max(150, "Khoa / Đơn vị không hợp lệ.")
    .nullable()
    .optional(),
  orderIndex: z.number().int().optional(),
});

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Tiêu đề nhiệm vụ phải có ít nhất 5 ký tự.")
    .max(255, "Tiêu đề không được vượt quá 255 ký tự."),
  slug: z.string().trim().optional(),
  description: z
    .string()
    .trim()
    .min(10, "Mô tả nhiệm vụ phải có ít nhất 10 ký tự."),
  requirements: z.string().trim().optional().nullable(),
  orderingOrganization: z
    .string()
    .trim()
    .min(2, "Đơn vị đặt hàng phải có ít nhất 2 ký tự.")
    .max(255, "Đơn vị đặt hàng không vượt quá 255 ký tự."),
  reward: z.string().trim().max(100).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  applicationDeadline: z.string().datetime().optional().nullable(),
  executionDeadline: z.string().datetime().optional().nullable(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.DRAFT),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  reason: z.string().trim().optional().nullable(),
});

export const adminUpdateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  reason: z.string().trim().optional().nullable(),
});

export const taskApplicationSubmitSchema = z.object({
  proposal: z
    .string()
    .trim()
    .min(10, "Đề xuất giải pháp thực hiện phải có ít nhất 10 ký tự."),
  fullName: z
    .string()
    .trim()
    .min(2, "Họ và tên người đăng ký phải có ít nhất 2 ký tự."),
  studentCode: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập mã cán bộ / mã sinh viên."),
  className: z
    .string()
    .trim()
    .min(2, "Lớp phải có ít nhất 2 ký tự."),
  email: createSmartEmailSchema("Email không đúng định dạng."),
  phone: z.string().trim().optional().nullable(),
  major: z.string().trim().optional().nullable(),
  members: z
    .array(memberItemSchema)
    .min(2, "Hồ sơ đăng ký phải có tối thiểu 2 thành viên (ít nhất 1 SV và 1 GVHD).")
    .max(10, "Hồ sơ đăng ký chỉ được phép có tối đa 10 thành viên."),
  lookupToken: z.string().trim().optional().nullable(),
});

export const taskApplicationDraftSchema = z.object({
  proposal: z.string().trim().optional().default(""),
  fullName: z
    .string()
    .trim()
    .min(2, "Họ và tên phải có ít nhất 2 ký tự."),
  studentCode: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập mã cán bộ / mã sinh viên."),
  className: z
    .string()
    .trim()
    .min(2, "Lớp phải có ít nhất 2 ký tự."),
  email: createSmartEmailSchema("Email không hợp lệ."),
  phone: z.string().trim().optional().nullable(),
  major: z.string().trim().optional().nullable(),
  members: z.array(memberItemSchema).default([]),
  lookupToken: z.string().trim().optional().nullable(),
});

export const adminSelectApplicationSchema = z.object({
  adminNote: z.string().trim().optional().nullable(),
});
