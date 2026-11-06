import { z } from "zod";
import { IdeaStatus } from "@/lib/domain/idea-state-machine";
import { createSmartEmailSchema } from "./email-validator";

export const RESEARCH_FIELDS = [
  "Công nghệ đường sắt hiện đại",
  "Công nghệ giao thông, Hạ tầng thông minh, BIM & Digital Twin",
  "Công nghệ thông tin, Trí tuệ nhân tạo & Dữ liệu",
  "Tự động hóa, Cơ điện tử & Kỹ thuật robot",
  "Logistics & Chuỗi cung ứng",
  "Công nghệ xanh, Năng lượng tái tạo & Môi trường",
  "Kinh tế số, Thương mại điện tử & Quản trị",
  "Công nghệ giáo dục (EdTech) & Quản lý đào tạo",
  "Khoa học xã hội, Luật - Chính trị, Ngôn ngữ & Lĩnh vực khác",
] as const;

export const POPULAR_BANKS = [
  "Agribank",
  "Vietcombank",
  "BIDV",
  "VietinBank",
  "MBBank",
  "Techcombank",
  "VPBank",
  "ACB",
  "TPBank",
  "Sacombank",
  "HDBank",
  "VIB",
  "SHB",
  "OCB",
  "MSB",
  "SeABank",
  "LPBank",
  "Ngân hàng khác",
] as const;

const VIETNAMESE_NAME_REGEX =
  /^[a-zA-ZàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ\s]+$/;
const VIETNAMESE_PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const BANK_ACCOUNT_REGEX = /^[0-9]{6,25}$/;

const INVALID_STATUS_NOTE_TITLES = new Set([
  "da sua",
  "đã sửa",
  "da sua lai",
  "đã sửa lại",
  "da sua lai ten",
  "đã sửa lại tên",
  "da sua ten",
  "đã sửa tên",
  "da sua ten de tai",
  "đã sửa tên đề tài",
  "da sua lai ten de tai",
  "đã sửa lại tên đề tài",
  "da chinh sua",
  "đã chỉnh sửa",
  "da cap nhat",
  "đã cập nhật",
  "da cap nhat ten",
  "đã cập nhật tên",
  "sua lai ten",
  "sửa lại tên",
  "sua lai ten de tai",
  "sửa lại tên đề tài",
  "sua ten de tai",
  "sửa tên đề tài",
]);

/**
 * Strips accidental trailing status notes like "(đã sửa lại tên)" or "- đã sửa lại tên"
 * so only the clean official project title is persisted.
 */
export function sanitizeProjectTitle(rawTitle: string): string {
  return rawTitle
    .trim()
    .replace(
      /\s*(?:\(|\[|-\s*)(?:đã sửa lại tên đề tài|đã sửa lại tên|đã sửa tên|đã chỉnh sửa|đã cập nhật tên|da sua lai ten)(?:\)|\])?\s*$/i,
      "",
    )
    .trim();
}

export const projectTitleSchema = z
  .string()
  .trim()
  .transform(sanitizeProjectTitle)
  .pipe(
    z
      .string()
      .min(5, "Tên ý tưởng / đề tài phải có ít nhất 5 ký tự")
      .max(250, "Tên ý tưởng / đề tài không được vượt quá 250 ký tự")
      .refine(
        (val) => {
          const normalized = val.trim().toLowerCase().replace(/\s+/g, " ");
          if (INVALID_STATUS_NOTE_TITLES.has(normalized)) {
            return false;
          }
          // Reject titles that are purely digits (e.g., "12345")
          if (/^\d+$/.test(normalized)) {
            return false;
          }
          return true;
        },
        {
          message:
            "Vui lòng nhập trực tiếp Tên đề tài chính thức mới (không nhập câu ghi chú trạng thái như 'đã sửa lại tên' hoặc dãy số vô nghĩa)",
        },
      ),
  );

export const ideaSubmissionSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, "Họ và tên phải có ít nhất 3 ký tự")
      .max(100, "Họ và tên không được vượt quá 100 ký tự")
      .refine(
        (val) => {
          const words = val.trim().split(/\s+/).filter(Boolean);
          return words.length >= 2 && VIETNAMESE_NAME_REGEX.test(val);
        },
        {
          message:
            "Vui lòng nhập họ và tên thật đầy đủ (tối thiểu 2 từ, không sử dụng nickname, số hoặc ký tự đặc biệt)",
        }
      ),
    studentCode: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập mã cán bộ / mã sinh viên"),
    className: z
      .string()
      .trim()
      .max(50, "Lớp không được vượt quá 50 ký tự")
      .optional()
      .or(z.literal("")),
    major: z
      .string()
      .trim()
      .max(100, "Ngành học không được vượt quá 100 ký tự")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .regex(
        VIETNAMESE_PHONE_REGEX,
        "Số điện thoại không đúng định dạng di động Việt Nam (Ví dụ: 0912345678)"
      ),
    email: createSmartEmailSchema("Địa chỉ email không hợp lệ"),
    bankAccountNumber: z
      .string()
      .trim()
      .regex(
        BANK_ACCOUNT_REGEX,
        "Số tài khoản ngân hàng chỉ nhận giá trị số từ 6 đến 25 chữ số"
      ),
    bankName: z
      .string()
      .trim()
      .min(2, "Vui lòng chọn hoặc nhập tên ngân hàng"),
    bankBranch: z
      .string()
      .trim()
      .max(255, "Chi nhánh ngân hàng không được vượt quá 255 ký tự")
      .optional()
      .or(z.literal("")),
    field: z
      .string()
      .trim()
      .min(1, "Vui lòng chọn lĩnh vực nghiên cứu"),
    title: projectTitleSchema,
    description: z
      .string()
      .trim()
      .min(20, "Mô tả chi tiết ý tưởng phải có ít nhất 20 ký tự để hội đồng có thể đánh giá")
      .max(10000, "Mô tả ý tưởng không được vượt quá 10.000 ký tự"),
    expectedProduct: z
      .string()
      .trim()
      .min(10, "Sản phẩm dự kiến phải có ít nhất 10 ký tự")
      .max(3000, "Sản phẩm dự kiến không được vượt quá 3000 ký tự"),
    necessity: z
      .string()
      .trim()
      .min(10, "Tính cấp thiết phải có ít nhất 10 ký tự")
      .max(3000, "Tính cấp thiết không được vượt quá 3000 ký tự"),
    innovation: z
      .string()
      .trim()
      .min(10, "Tính mới & sáng tạo sơ bộ phải có ít nhất 10 ký tự")
      .max(3000, "Tính mới & sáng tạo sơ bộ không được vượt quá 3000 ký tự"),
    feasibility: z
      .string()
      .trim()
      .min(10, "Tính khả thi phải có ít nhất 10 ký tự")
      .max(3000, "Tính khả thi không được vượt quá 3000 ký tự"),
    potential: z
      .string()
      .trim()
      .min(10, "Tiềm năng phát triển phải có ít nhất 10 ký tự")
      .max(3000, "Tiềm năng phát triển không được vượt quá 3000 ký tự"),
    needsMemberSupport: z.boolean({
      message: "Vui lòng chọn nhu cầu hỗ trợ bổ sung thành viên ở Vòng 2",
    }),
  })
  .refine(
    (data) => {
      const isAgribank =
        data.bankName.trim().toLowerCase() === "agribank" ||
        data.bankName.trim().toLowerCase().includes("agribank");
      if (isAgribank) {
        return Boolean(data.bankBranch && data.bankBranch.trim().length > 0);
      }
      return true;
    },
    {
      message: "Chi nhánh ngân hàng là bắt buộc khi chọn ngân hàng Agribank",
      path: ["bankBranch"],
    }
  );

export type IdeaSubmissionInput = z.infer<typeof ideaSubmissionSchema>;

export const lookupRequestSchema = z.object({
  email: createSmartEmailSchema("Địa chỉ email không hợp lệ"),
});

export type LookupRequestInput = z.infer<typeof lookupRequestSchema>;

export const adminStatusUpdateSchema = z
  .object({
    ideaId: z.string().min(1, "ID ý tưởng không hợp lệ"),
    expectedOldStatus: z.nativeEnum(IdeaStatus, {
      message: "Trạng thái cũ không hợp lệ",
    }),
    newStatus: z.nativeEnum(IdeaStatus, {
      message: "Trạng thái mới không hợp lệ",
    }),
    reason: z
      .string()
      .trim()
      .max(2000, "Lý do không được vượt quá 2000 ký tự")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (
        data.newStatus === IdeaStatus.REJECTED ||
        data.newStatus === IdeaStatus.NEEDS_REVISION
      ) {
        return Boolean(data.reason && data.reason.trim().length > 0);
      }
      return true;
    },
    {
      message: "Bắt buộc phải nhập lý do khi từ chối hoặc yêu cầu chỉnh sửa",
      path: ["reason"],
    },
  );

export type AdminStatusUpdateInput = z.infer<typeof adminStatusUpdateSchema>;

export const ideaResubmissionSchema = z
  .object({
    lookupToken: z.string().trim().min(1, "Vui lòng cung cấp mã truy cập hợp lệ"),
    fullName: z
      .string()
      .trim()
      .min(3, "Họ và tên phải có ít nhất 3 ký tự")
      .max(100, "Họ và tên không được vượt quá 100 ký tự")
      .refine(
        (val) => {
          const words = val.trim().split(/\s+/).filter(Boolean);
          return words.length >= 2 && VIETNAMESE_NAME_REGEX.test(val);
        },
        {
          message:
            "Vui lòng nhập họ và tên thật đầy đủ (tối thiểu 2 từ, không sử dụng nickname, số hoặc ký tự đặc biệt)",
        }
      ),
    studentCode: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập mã cán bộ / mã sinh viên"),
    className: z
      .string()
      .trim()
      .max(50, "Lớp không được vượt quá 50 ký tự")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .regex(
        VIETNAMESE_PHONE_REGEX,
        "Số điện thoại không đúng định dạng di động Việt Nam (Ví dụ: 0912345678)"
      ),
    bankAccountNumber: z
      .string()
      .trim()
      .regex(
        BANK_ACCOUNT_REGEX,
        "Số tài khoản ngân hàng chỉ nhận giá trị số từ 6 đến 25 chữ số"
      ),
    bankName: z
      .string()
      .trim()
      .min(2, "Vui lòng chọn hoặc nhập tên ngân hàng"),
    bankBranch: z
      .string()
      .trim()
      .max(255, "Chi nhánh ngân hàng không được vượt quá 255 ký tự")
      .optional()
      .or(z.literal("")),
    field: z
      .string()
      .trim()
      .min(1, "Vui lòng chọn lĩnh vực nghiên cứu"),
    title: projectTitleSchema,
    description: z
      .string()
      .trim()
      .min(20, "Mô tả chi tiết ý tưởng phải có ít nhất 20 ký tự để hội đồng có thể đánh giá")
      .max(10000, "Mô tả ý tưởng không được vượt quá 10.000 ký tự"),
    expectedProduct: z
      .string()
      .trim()
      .min(10, "Sản phẩm dự kiến phải có ít nhất 10 ký tự")
      .max(3000, "Sản phẩm dự kiến không được vượt quá 3000 ký tự"),
    necessity: z
      .string()
      .trim()
      .min(10, "Tính cấp thiết phải có ít nhất 10 ký tự")
      .max(3000, "Tính cấp thiết không được vượt quá 3000 ký tự"),
    innovation: z
      .string()
      .trim()
      .min(10, "Tính mới & sáng tạo sơ bộ phải có ít nhất 10 ký tự")
      .max(3000, "Tính mới & sáng tạo sơ bộ không được vượt quá 3000 ký tự"),
    feasibility: z
      .string()
      .trim()
      .min(10, "Tính khả thi phải có ít nhất 10 ký tự")
      .max(3000, "Tính khả thi không được vượt quá 3000 ký tự"),
    potential: z
      .string()
      .trim()
      .min(10, "Tiềm năng phát triển phải có ít nhất 10 ký tự")
      .max(3000, "Tiềm năng phát triển không được vượt quá 3000 ký tự"),
    needsMemberSupport: z.boolean({
      message: "Vui lòng chọn nhu cầu hỗ trợ bổ sung thành viên ở Vòng 2",
    }),
  })
  .refine(
    (data) => {
      const isAgribank =
        data.bankName.trim().toLowerCase() === "agribank" ||
        data.bankName.trim().toLowerCase().includes("agribank");
      if (isAgribank) {
        return Boolean(data.bankBranch && data.bankBranch.trim().length > 0);
      }
      return true;
    },
    {
      message: "Chi nhánh ngân hàng là bắt buộc khi chọn ngân hàng Agribank",
      path: ["bankBranch"],
    }
  );

export type IdeaResubmissionInput = z.infer<typeof ideaResubmissionSchema>;
