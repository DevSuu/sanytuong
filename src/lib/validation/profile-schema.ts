import { z } from "zod";
import { MemberType } from "@/generated/prisma/client";
import { createSmartEmailSchema } from "./email-validator";
import { projectTitleSchema, sanitizeProjectTitle } from "./idea-schema";

export const memberInputSchema = z.object({
  id: z.string().optional(),
  memberType: z.nativeEnum(MemberType, {
    message: "Loại thành viên không hợp lệ (Sinh viên hoặc GVHD).",
  }),
  isLeader: z.boolean().default(false),
  fullName: z
    .string()
    .trim()
    .min(2, "Họ và tên phải có ít nhất 2 ký tự.")
    .max(100, "Họ và tên không được vượt quá 100 ký tự."),
  email: createSmartEmailSchema("Địa chỉ email không hợp lệ."),
  studentCode: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
  className: z
    .string()
    .trim()
    .max(50, "Lớp không được vượt quá 50 ký tự.")
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
  phone: z
    .string()
    .trim()
    .max(20, "Số điện thoại không được vượt quá 20 ký tự.")
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
  department: z
    .string()
    .trim()
    .max(150, "Đơn vị/Khoa không được vượt quá 150 ký tự.")
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
  orderIndex: z.number().int().nonnegative().optional().default(0),
});

export type MemberInput = z.infer<typeof memberInputSchema>;

export const draftMemberInputSchema = z.object({
  id: z.string().optional(),
  memberType: z.nativeEnum(MemberType, {
    message: "Loại thành viên không hợp lệ (Sinh viên hoặc GVHD).",
  }),
  isLeader: z.boolean().default(false),
  fullName: z
    .string()
    .trim()
    .max(100, "Họ và tên không được vượt quá 100 ký tự.")
    .optional()
    .default(""),
  email: z
    .string()
    .trim()
    .max(150, "Email không được vượt quá 150 ký tự.")
    .optional()
    .default(""),
  studentCode: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
  className: z
    .string()
    .trim()
    .max(50, "Lớp không được vượt quá 50 ký tự.")
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
  phone: z
    .string()
    .trim()
    .max(20, "Số điện thoại không được vượt quá 20 ký tự.")
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
  department: z
    .string()
    .trim()
    .max(150, "Đơn vị/Khoa không được vượt quá 150 ký tự.")
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
  orderIndex: z.number().int().nonnegative().optional().default(0),
});

export const profileDraftSaveSchema = z.object({
  title: z
    .string()
    .trim()
    .max(250, "Tên đề tài không được vượt quá 250 ký tự.")
    .transform(sanitizeProjectTitle)
    .optional(),
  members: z
    .array(draftMemberInputSchema)
    .max(10, "Hồ sơ đề tài không được vượt quá 10 thành viên."),
});

export type ProfileDraftSaveInput = z.infer<typeof profileDraftSaveSchema>;

export const profileSubmitSchema = z.object({
  title: projectTitleSchema.optional(),
  members: z
    .array(memberInputSchema)
    .min(2, "Hồ sơ đề tài phải có tối thiểu 2 thành viên.")
    .max(10, "Hồ sơ đề tài chỉ được phép có tối đa 10 thành viên."),
});

export type ProfileSubmitInput = z.infer<typeof profileSubmitSchema>;

export const createEditRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Lý do xin chỉnh sửa phải có ít nhất 5 ký tự.")
    .max(2000, "Lý do không được vượt quá 2000 ký tự."),
  requestedFields: z
    .array(z.string().trim().min(1, "Tên trường không được rỗng."))
    .min(1, "Phải chọn hoặc nhập ít nhất một trường thông tin cần chỉnh sửa."),
});

export type CreateEditRequestInput = z.infer<typeof createEditRequestSchema>;

export const adminReviewProfileSchema = z
  .object({
    action: z.enum(["APPROVE", "REQUEST_REVISION"], {
      message: "Hành động duyệt không hợp lệ.",
    }),
    reason: z
      .string()
      .trim()
      .max(2000, "Lý do/hướng dẫn không được vượt quá 2000 ký tự.")
      .optional()
      .or(z.literal("")),
    revisionReason: z
      .string()
      .trim()
      .max(2000, "Lý do/hướng dẫn không được vượt quá 2000 ký tự.")
      .optional(),
  })
  .transform((data) => ({
    action: data.action,
    reason: data.reason || data.revisionReason || "",
  }))
  .refine(
    (data) => {
      if (data.action === "REQUEST_REVISION") {
        return Boolean(data.reason && data.reason.trim().length > 0);
      }
      return true;
    },
    {
      message: "Bắt buộc phải nhập lý do/hướng dẫn khi yêu cầu bổ sung hồ sơ.",
      path: ["reason"],
    },
  );

export type AdminReviewProfileInput = z.infer<typeof adminReviewProfileSchema>;

export const adminReviewEditRequestSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"], {
      message: "Hành động không hợp lệ.",
    }),
    allowedFields: z.array(z.string().trim()).optional().default([]),
    rejectionReason: z
      .string()
      .trim()
      .max(2000, "Lý do từ chối không được vượt quá 2000 ký tự.")
      .optional()
      .or(z.literal("")),
    adminNote: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.action === "REJECT") {
        return Boolean(data.rejectionReason && data.rejectionReason.trim().length > 0);
      }
      return true;
    },
    {
      message: "Bắt buộc phải nhập lý do khi từ chối yêu cầu chỉnh sửa.",
      path: ["rejectionReason"],
    },
  );

export type AdminReviewEditRequestInput = z.infer<typeof adminReviewEditRequestSchema>;

export const adminDirectEditProfileSchema = z.object({
  title: projectTitleSchema.optional(),
  members: z
    .array(memberInputSchema)
    .min(2, "Hồ sơ đề tài phải có tối thiểu 2 thành viên.")
    .max(10, "Hồ sơ đề tài không được vượt quá 10 thành viên."),
  reason: z
    .string()
    .trim()
    .min(5, "Bắt buộc phải nhập lý do chỉnh sửa trực tiếp (tối thiểu 5 ký tự) cho audit log.")
    .max(2000, "Lý do không được vượt quá 2000 ký tự."),
});

export type AdminDirectEditProfileInput = z.infer<typeof adminDirectEditProfileSchema>;
