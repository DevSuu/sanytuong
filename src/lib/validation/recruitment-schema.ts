import { z } from "zod";
import { createSmartEmailSchema } from "./email-validator";

export const recruitmentPostCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Tiêu đề tin tuyển dụng phải từ 5 ký tự trở lên.")
    .max(200, "Tiêu đề tin tuyển dụng không quá 200 ký tự."),
  description: z
    .string()
    .trim()
    .min(20, "Mô tả yêu cầu và công việc phải từ 20 ký tự trở lên.")
    .max(3000, "Mô tả không được vượt quá 3000 ký tự."),
  targetMemberCount: z
    .number()
    .int("Số lượng phải là số nguyên.")
    .min(1, "Số lượng thành viên cần tuyển tối thiểu là 1.")
    .max(9, "Số lượng thành viên cần tuyển tối đa là 9."),
  requiredSkills: z
    .string()
    .trim()
    .min(2, "Vui lòng nhập các kỹ năng hoặc chuyên môn mong muốn.")
    .max(1000, "Kỹ năng yêu cầu không quá 1000 ký tự."),
});

export const recruitmentPostUpdateSchema = recruitmentPostCreateSchema.partial().extend({
  status: z.enum(["DRAFT", "PUBLISHED", "PAUSED", "CLOSED"]).optional(),
});

export const recruitmentApplicationSubmitSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Họ và tên phải có ít nhất 2 ký tự.")
    .max(100, "Họ và tên không vượt quá 100 ký tự."),
  studentCode: z
    .string()
    .trim()
    .min(5, "Mã sinh viên phải từ 5 ký tự trở lên.")
    .max(20, "Mã sinh viên không vượt quá 20 ký tự.")
    .regex(/^[a-zA-Z0-9]+$/, "Mã sinh viên chỉ chứa chữ và số."),
  email: createSmartEmailSchema("Email không đúng định dạng.").transform((v) =>
    v.toLowerCase()
  ),
  className: z
    .string()
    .trim()
    .max(50, "Tên lớp không quá 50 ký tự.")
    .optional()
    .nullable(),
  phone: z
    .string()
    .trim()
    .max(20, "Số điện thoại không quá 20 ký tự.")
    .optional()
    .nullable()
    .refine((val) => !val || /^[0-9+() -]{9,20}$/.test(val), {
      message: "Số điện thoại không hợp lệ.",
    }),
  specialty: z
    .string()
    .trim()
    .min(3, "Vui lòng nêu rõ chuyên môn / kỹ năng chính.")
    .max(500, "Chuyên môn không quá 500 ký tự."),
  motivation: z
    .string()
    .trim()
    .min(10, "Lý do tham gia đề tài phải có ít nhất 10 ký tự.")
    .max(1500, "Lý do tham gia không quá 1500 ký tự."),
  contribution: z
    .string()
    .trim()
    .min(10, "Dự kiến đóng góp cho đề tài phải có ít nhất 10 ký tự.")
    .max(1500, "Dự kiến đóng góp không quá 1500 ký tự."),
  // Invariant 5: Explicit consent requirement
  consentAccepted: z
    .boolean()
    .refine((val) => val === true, {
      message: "Bạn phải xác nhận đồng ý chia sẻ thông tin ứng tuyển với Trưởng nhóm đề tài để phục vụ xét duyệt.",
    }),
});

export const recruitmentVerifyOtpSchema = z.object({
  applicationId: z.string().trim().min(1, "Thiếu mã đơn ứng tuyển."),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Mã OTP phải gồm đúng 6 chữ số."),
});

export const recruitmentResendOtpSchema = z.object({
  applicationId: z.string().trim().min(1, "Thiếu mã đơn ứng tuyển."),
});

export const recruitmentApplicationReviewSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT"]),
  reviewNote: z
    .string()
    .trim()
    .max(1000, "Ghi chú xét duyệt không quá 1000 ký tự.")
    .optional()
    .nullable(),
});

export type RecruitmentPostCreateInput = z.infer<typeof recruitmentPostCreateSchema>;
export type RecruitmentPostUpdateInput = z.infer<typeof recruitmentPostUpdateSchema>;
export type RecruitmentApplicationSubmitInput = z.infer<typeof recruitmentApplicationSubmitSchema>;
export type RecruitmentVerifyOtpInput = z.infer<typeof recruitmentVerifyOtpSchema>;
export type RecruitmentApplicationReviewInput = z.infer<typeof recruitmentApplicationReviewSchema>;
