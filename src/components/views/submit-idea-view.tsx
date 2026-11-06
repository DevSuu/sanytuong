"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  Loader2,
  Send,
  AlertCircle,
  Hash,
  Mail,
  User,
  Lightbulb,
  CreditCard,
  Users,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ideaSubmissionSchema,
  IdeaSubmissionInput,
  RESEARCH_FIELDS,
  POPULAR_BANKS,
} from "@/lib/validation/idea-schema";
import { validateSmartEmail } from "@/lib/validation/email-validator";

const IDEA_DRAFT_STORAGE_KEY = "utt_submit_idea_draft_v1";

const EMPTY_FORM_VALUES: IdeaSubmissionInput = {
  fullName: "",
  studentCode: "",
  className: "",
  phone: "",
  email: "",
  bankAccountNumber: "",
  bankName: "",
  bankBranch: "",
  field: "",
  title: "",
  description: "",
  expectedProduct: "",
  necessity: "",
  innovation: "",
  feasibility: "",
  potential: "",
  needsMemberSupport: false,
};

export function SubmitIdeaView() {
  const [submitSuccess, setSubmitSuccess] = useState<{
    referenceCode: string;
    email: string;
    emailVerified: boolean;
    message: string;
  } | null>(null);

  const [serverError, setServerError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<IdeaSubmissionInput>({
    resolver: zodResolver(ideaSubmissionSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  const watchedEmail = useWatch({ control, name: "email" }) || "";
  const emailTypoCheck =
    watchedEmail.includes("@") && watchedEmail.trim().length > 4
      ? validateSmartEmail(watchedEmail)
      : null;

  // 1. Restore saved draft from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(IDEA_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<IdeaSubmissionInput> & { _savedAt?: string };
      if (!parsed || typeof parsed !== "object") return;

      const hasContent = Object.entries(EMPTY_FORM_VALUES).some(([key]) => {
        const val = parsed[key as keyof IdeaSubmissionInput];
        return typeof val === "string" && val.trim().length > 0;
      });

      if (hasContent) {
        reset({
          ...EMPTY_FORM_VALUES,
          fullName: typeof parsed.fullName === "string" ? parsed.fullName : "",
          studentCode: typeof parsed.studentCode === "string" ? parsed.studentCode : "",
          className: typeof parsed.className === "string" ? parsed.className : "",
          phone: typeof parsed.phone === "string" ? parsed.phone : "",
          email: typeof parsed.email === "string" ? parsed.email : "",
          bankAccountNumber: typeof parsed.bankAccountNumber === "string" ? parsed.bankAccountNumber : "",
          bankName: typeof parsed.bankName === "string" ? parsed.bankName : "",
          bankBranch: typeof parsed.bankBranch === "string" ? parsed.bankBranch : "",
          field: typeof parsed.field === "string" ? parsed.field : "",
          title: typeof parsed.title === "string" ? parsed.title : "",
          description: typeof parsed.description === "string" ? parsed.description : "",
          expectedProduct: typeof parsed.expectedProduct === "string" ? parsed.expectedProduct : "",
          necessity: typeof parsed.necessity === "string" ? parsed.necessity : "",
          innovation: typeof parsed.innovation === "string" ? parsed.innovation : "",
          feasibility: typeof parsed.feasibility === "string" ? parsed.feasibility : "",
          potential: typeof parsed.potential === "string" ? parsed.potential : "",
          needsMemberSupport: Boolean(parsed.needsMemberSupport),
        });
        setDraftRestored(true);
        if (typeof parsed._savedAt === "string") {
          setDraftSavedAt(parsed._savedAt);
        }
      }
    } catch {
      // Ignore storage access errors in private browsing modes
    }
  }, [reset]);

  // 2. Auto-save form changes to localStorage (debounced 400ms)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const subscription = watch((values) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const hasAnyText = Object.values(values).some(
            (v) => typeof v === "string" && v.trim().length > 0,
          );
          if (!hasAnyText) {
            window.localStorage.removeItem(IDEA_DRAFT_STORAGE_KEY);
            setDraftSavedAt(null);
            return;
          }
          const timeLabel = new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          window.localStorage.setItem(
            IDEA_DRAFT_STORAGE_KEY,
            JSON.stringify({ ...values, _savedAt: timeLabel }),
          );
          setDraftSavedAt(timeLabel);
        } catch {
          // Ignore storage quota errors
        }
      }, 400);
    });

    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [watch]);

  const handleClearDraft = () => {
    try {
      window.localStorage.removeItem(IDEA_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    reset(EMPTY_FORM_VALUES);
    setDraftSavedAt(null);
    setDraftRestored(false);
    setServerError(null);
  };

  const selectedBankName = useWatch({ control, name: "bankName" });
  const isAgribank =
    selectedBankName?.trim().toLowerCase() === "agribank" ||
    selectedBankName?.trim().toLowerCase().includes("agribank");

  const onSubmit = async (values: IdeaSubmissionInput) => {
    setServerError(null);
    try {
      const res = await fetch("/api/ideas/submit", {
        method: "POST",
        headers: (() => { const h: Record<string, string> = { "Content-Type": "application/json" }; try { const t = typeof window !== "undefined" ? window.localStorage.getItem("utt_lookup_token")?.trim() : ""; if (t) h["x-lookup-token"] = t; } catch { /* ignore storage access */ } return h; })(),
        body: JSON.stringify(values),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setServerError(json.error || "Gửi ý tưởng thất bại. Vui lòng thử lại.");
        return;
      }

      try {
        window.localStorage.removeItem(IDEA_DRAFT_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
      setDraftSavedAt(null);
      setDraftRestored(false);

      setSubmitSuccess({
        referenceCode: json.data.referenceCode,
        email: json.data.email,
        emailVerified: json.data.emailVerified,
        message: json.message,
      });
      reset(EMPTY_FORM_VALUES);
    } catch {
      setServerError("Lỗi kết nối máy chủ. Vui lòng kiểm tra lại mạng.");
    }
  };

  return (
    <div className="container page-shell">
      <p className="eyebrow">THỬ THÁCH SÁNG TẠO 4.0 · UTT</p>
      <h1>Gửi ý tưởng</h1>
      <p className="page-intro">
        Đề xuất giải pháp sáng tạo cho các vấn đề thực tiễn của bạn hoặc nhà trường.
      </p>

      {submitSuccess ? (
        <div
          className="form-panel"
          style={{
            maxWidth: 680,
            margin: "32px auto",
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <CheckCircle2
            size={56}
            style={{ margin: "0 auto 16px", color: "var(--brand-orange)" }}
          />
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>Tiếp nhận hồ sơ thành công!</h2>
          <p className="page-intro" style={{ marginTop: 8 }}>
            {submitSuccess.message}
          </p>

          <div
            style={{
              margin: "24px auto",
              padding: "16px 20px",
              background: "var(--surface)",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              maxWidth: 420,
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
              <Hash size={14} /> Mã hồ sơ ý tưởng:
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-orange)", marginTop: 4 }}>
              {submitSuccess.referenceCode}
            </div>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
              <Mail size={14} /> Hòm thư đăng ký:
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginTop: 2 }}>
              {submitSuccess.email}
            </div>
          </div>

          {!submitSuccess.emailVerified && (
            <div
              style={{
                background: "rgba(234, 88, 12, 0.08)",
                border: "1px solid rgba(234, 88, 12, 0.25)",
                padding: "14px 18px",
                borderRadius: "8px",
                fontSize: 13,
                color: "var(--foreground)",
                textAlign: "left",
                lineHeight: 1.6,
                margin: "0 auto 24px auto",
                maxWidth: 520,
              }}
            >
              <strong>Lưu ý quan trọng:</strong> Hệ thống đã gửi một liên kết xác minh tới email{" "}
              <strong>{submitSuccess.email}</strong>. Vui lòng mở email và nhấn xác nhận để hồ sơ của bạn được chính thức chuyển tới Ban giám khảo cuộc thi!
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Button
              onClick={() => {
                setSubmitSuccess(null);
                reset();
              }}
              variant="outline"
            >
              Gửi thêm ý tưởng khác
            </Button>
          </div>
        </div>
      ) : (
        <form className="form-panel" onSubmit={handleSubmit(onSubmit)} noValidate style={{ maxWidth: 880, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 20,
              padding: "10px 14px",
              background: draftRestored ? "rgba(22, 163, 74, 0.08)" : "var(--surface)",
              border: draftRestored ? "1px solid rgba(22, 163, 74, 0.25)" : "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}>
              <Save size={15} color="var(--brand-orange)" style={{ flexShrink: 0 }} />
              <span>
                {draftSavedAt ? (
                  <>
                    {draftRestored ? "Đã khôi phục bản nháp • " : ""}
                    Đã tự động lưu nháp lúc <strong style={{ color: "var(--foreground)" }}>{draftSavedAt}</strong>
                  </>
                ) : (
                  "Nội dung bạn nhập sẽ được tự động lưu nháp trên trình duyệt để tránh mất dữ liệu."
                )}
              </span>
            </div>

            {draftSavedAt && (
              <button
                type="button"
                onClick={handleClearDraft}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                  color: "var(--muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={13} />
                Xóa bản nháp
              </button>
            )}
          </div>

          {serverError && (
            <div
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                background: "rgba(220, 38, 38, 0.08)",
                border: "1px solid rgba(220, 38, 38, 0.3)",
                borderRadius: "8px",
                color: "#dc2626",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{serverError}</span>
            </div>
          )}

          {/* SECTION 1: THÔNG TIN NGƯỜI ĐẠI DIỆN & TÀI KHOẢN HỖ TRỢ */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 20 }}>
              <User size={20} color="var(--brand-orange)" />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>1. Thông tin Người đại diện & Nhận hỗ trợ kinh phí</h2>
            </div>

            <div className="form-grid">
              {/* Họ và tên */}
              <div className="form-field">
                <label htmlFor="fullName">Họ và tên người đại diện nhóm *</label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Ví dụ: Nguyễn Văn An (Nhập họ tên thật)"
                  disabled={isSubmitting}
                  {...register("fullName")}
                />
                {errors.fullName && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.fullName.message}
                  </span>
                )}
              </div>

              {/* Mã cán bộ / sinh viên */}
              <div className="form-field">
                <label htmlFor="studentCode">Mã cán bộ / mã sinh viên *</label>
                <input
                  id="studentCode"
                  type="text"
                  autoComplete="off"
                  placeholder="Ví dụ: 72DCHT21001 hoặc mã cán bộ"
                  disabled={isSubmitting}
                  {...register("studentCode")}
                />
                {errors.studentCode && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.studentCode.message}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="form-field">
                <label htmlFor="email">Email liên hệ *</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="an.nv@utt.edu.vn hoặc email cá nhân / doanh nghiệp"
                  disabled={isSubmitting}
                  {...register("email")}
                />
                {emailTypoCheck && !emailTypoCheck.valid && emailTypoCheck.suggestion && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.35)",
                      fontSize: 12,
                      color: "#d97706",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>
                      Phát hiện gõ nhầm tên miền. Ý của bạn là{" "}
                      <strong>{emailTypoCheck.suggestion}</strong>?
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setValue("email", emailTypoCheck.suggestion!, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      style={{
                        background: "var(--brand-orange)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 5,
                        padding: "3px 9px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Sửa thành {emailTypoCheck.suggestion}
                    </button>
                  </div>
                )}
                {errors.email && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.email.message}
                  </span>
                )}
              </div>

              {/* Số điện thoại */}
              <div className="form-field">
                <label htmlFor="phone">Số điện thoại *</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="0912 345 678"
                  disabled={isSubmitting}
                  {...register("phone")}
                />
                {errors.phone && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.phone.message}
                  </span>
                )}
              </div>

              {/* Lớp sinh hoạt */}
              <div className="form-field full">
                <label htmlFor="className">Lớp sinh hoạt (không bắt buộc với Cán bộ)</label>
                <input
                  id="className"
                  type="text"
                  autoComplete="off"
                  placeholder="Ví dụ: 72DCHT21 (để trống nếu là Cán bộ / Giảng viên)"
                  disabled={isSubmitting}
                  {...register("className")}
                />
                {errors.className && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.className.message}
                  </span>
                )}
              </div>
            </div>

            {/* Thông tin ngân hàng */}
            <div style={{ marginTop: 20, padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                <CreditCard size={16} color="var(--brand-orange)" />
                Thông tin Tài khoản Ngân hàng (Phục vụ chi trả hỗ trợ & giải thưởng)
              </div>

              <div className="form-grid">
                {/* Tên ngân hàng */}
                <div className="form-field">
                  <label htmlFor="bankName">Tên ngân hàng *</label>
                  <select
                    id="bankName"
                    disabled={isSubmitting}
                    {...register("bankName")}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="">-- Chọn ngân hàng thụ hưởng --</option>
                    {POPULAR_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  {errors.bankName && (
                    <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                      {errors.bankName.message}
                    </span>
                  )}
                </div>

                {/* Số tài khoản */}
                <div className="form-field">
                  <label htmlFor="bankAccountNumber">Số tài khoản ngân hàng *</label>
                  <input
                    id="bankAccountNumber"
                    type="text"
                    autoComplete="off"
                    placeholder="Chỉ nhập chữ số (ví dụ: 19034567890123)"
                    disabled={isSubmitting}
                    {...register("bankAccountNumber")}
                  />
                  {errors.bankAccountNumber && (
                    <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                      {errors.bankAccountNumber.message}
                    </span>
                  )}
                </div>

                {/* Chi nhánh */}
                <div className="form-field full">
                  <label htmlFor="bankBranch">
                    Chi nhánh ngân hàng {isAgribank ? <strong style={{ color: "#dc2626" }}>* (Bắt buộc với Agribank)</strong> : "(Tùy chọn)"}
                  </label>
                  <input
                    id="bankBranch"
                    type="text"
                    autoComplete="off"
                    placeholder={isAgribank ? "Ví dụ: Agribank Chi nhánh Thanh Xuân, Hà Nội" : "Ví dụ: Chi nhánh Cầu Giấy (không bắt buộc)"}
                    disabled={isSubmitting}
                    {...register("bankBranch")}
                  />
                  {errors.bankBranch && (
                    <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                      {errors.bankBranch.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: NỘI DUNG CHI TIẾT Ý TƯỞNG */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 20 }}>
              <Lightbulb size={20} color="var(--brand-orange)" />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>2. Nội dung Chi tiết Ý tưởng & Đề tài</h2>
            </div>

            <div className="form-grid">
              {/* Lĩnh vực nghiên cứu */}
              <div className="form-field full">
                <label htmlFor="field">Lĩnh vực nghiên cứu *</label>
                <select
                  id="field"
                  disabled={isSubmitting}
                  {...register("field")}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="">-- Chọn lĩnh vực nghiên cứu phù hợp nhất --</option>
                  {RESEARCH_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                {errors.field && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.field.message}
                  </span>
                )}
              </div>

              {/* Tên ý tưởng */}
              <div className="form-field full">
                <label htmlFor="title">Tên ý tưởng / đề tài *</label>
                <input
                  id="title"
                  type="text"
                  placeholder="VD: Ứng dụng AI phân luồng giao thông quanh cổng trường"
                  disabled={isSubmitting}
                  {...register("title")}
                />
                {errors.title && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.title.message}
                  </span>
                )}
              </div>

              {/* Mô tả chi tiết ý tưởng */}
              <div className="form-field full">
                <label htmlFor="description">Mô tả chi tiết ý tưởng *</label>
                <textarea
                  id="description"
                  rows={5}
                  maxLength={10000}
                  placeholder="Bạn muốn giải quyết vấn đề gì? Giải pháp của bạn hoạt động như thế nào? Kết quả mong đợi ra sao?"
                  disabled={isSubmitting}
                  {...register("description")}
                />
                {errors.description && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.description.message}
                  </span>
                )}
              </div>

              {/* Sản phẩm dự kiến */}
              <div className="form-field full">
                <label htmlFor="expectedProduct">Sản phẩm dự kiến *</label>
                <textarea
                  id="expectedProduct"
                  rows={3}
                  maxLength={3000}
                  placeholder="Ví dụ: Ứng dụng di động iOS/Android, bản mẫu thiết bị phần cứng IoT, quy trình kỹ thuật, báo cáo phân tích..."
                  disabled={isSubmitting}
                  {...register("expectedProduct")}
                />
                {errors.expectedProduct && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.expectedProduct.message}
                  </span>
                )}
              </div>

              {/* Tính cấp thiết */}
              <div className="form-field full">
                <label htmlFor="necessity">Tính cấp thiết *</label>
                <textarea
                  id="necessity"
                  rows={3}
                  maxLength={3000}
                  placeholder="Tại sao vấn đề này cần được giải quyết ngay? Thực trạng và mức độ ảnh hưởng của vấn đề hiện nay..."
                  disabled={isSubmitting}
                  {...register("necessity")}
                />
                {errors.necessity && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.necessity.message}
                  </span>
                )}
              </div>

              {/* Tính mới & sáng tạo sơ bộ */}
              <div className="form-field full">
                <label htmlFor="innovation">Tính mới & sáng tạo sơ bộ *</label>
                <textarea
                  id="innovation"
                  rows={3}
                  maxLength={3000}
                  placeholder="Giải pháp của bạn có điểm gì khác biệt, độc đáo so với các phương pháp hoặc sản phẩm hiện có trên thị trường?"
                  disabled={isSubmitting}
                  {...register("innovation")}
                />
                {errors.innovation && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.innovation.message}
                  </span>
                )}
              </div>

              {/* Tính khả thi */}
              <div className="form-field full">
                <label htmlFor="feasibility">Tính khả thi *</label>
                <textarea
                  id="feasibility"
                  rows={3}
                  maxLength={3000}
                  placeholder="Khả năng hiện thực hóa giải pháp: công nghệ sử dụng, điều kiện phòng lab/cơ sở vật chất, nhân lực, lộ trình..."
                  disabled={isSubmitting}
                  {...register("feasibility")}
                />
                {errors.feasibility && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.feasibility.message}
                  </span>
                )}
              </div>

              {/* Tiềm năng phát triển */}
              <div className="form-field full">
                <label htmlFor="potential">Tiềm năng phát triển *</label>
                <textarea
                  id="potential"
                  rows={3}
                  maxLength={3000}
                  placeholder="Khả năng mở rộng quy mô, ứng dụng trong thực tế doanh nghiệp/xã hội, hoặc thương mại hóa trong tương lai..."
                  disabled={isSubmitting}
                  {...register("potential")}
                />
                {errors.potential && (
                  <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                    {errors.potential.message}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: KẾ HOẠCH NHÂN SỰ VÒNG 2 */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 20 }}>
              <Users size={20} color="var(--brand-orange)" />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>3. Kế hoạch Nhân sự & Đồng hành</h2>
            </div>

            <div style={{ padding: "18px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
              <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>
                Có cần Ban tổ chức hỗ trợ kết nối / bổ sung thành viên ở Vòng 2 không? *
              </label>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                Nếu nhóm bạn đang thiếu nhân sự chuyên môn (lập trình, cơ khí, kinh tế, thiết kế...), Ban tổ chức sẽ hỗ trợ ghép nhóm với các bạn sinh viên phù hợp ở Vòng 2.
              </p>

              <Controller
                control={control}
                name="needsMemberSupport"
                render={({ field }) => (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                      gap: 12,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        cursor: "pointer",
                        fontSize: 14,
                        lineHeight: 1.45,
                        padding: "12px 14px",
                        borderRadius: 10,
                        border:
                          field.value === true
                            ? "1.5px solid var(--brand-orange)"
                            : "1px solid var(--border)",
                        background:
                          field.value === true
                            ? "rgba(242, 92, 5, 0.08)"
                            : "var(--background)",
                        transition: "border-color 0.15s ease, background 0.15s ease",
                      }}
                    >
                      <input
                        id="needsMemberSupportYes"
                        type="radio"
                        name="needsMemberSupportGroup"
                        checked={field.value === true}
                        onChange={() => field.onChange(true)}
                        disabled={isSubmitting}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        <strong>Có</strong>, tôi cần hỗ trợ kết nối thêm thành viên
                      </span>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        cursor: "pointer",
                        fontSize: 14,
                        lineHeight: 1.45,
                        padding: "12px 14px",
                        borderRadius: 10,
                        border:
                          field.value === false
                            ? "1.5px solid var(--brand-orange)"
                            : "1px solid var(--border)",
                        background:
                          field.value === false
                            ? "rgba(242, 92, 5, 0.08)"
                            : "var(--background)",
                        transition: "border-color 0.15s ease, background 0.15s ease",
                      }}
                    >
                      <input
                        id="needsMemberSupportNo"
                        type="radio"
                        name="needsMemberSupportGroup"
                        checked={field.value === false}
                        onChange={() => field.onChange(false)}
                        disabled={isSubmitting}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        <strong>Không</strong>, nhóm tôi đã có đủ thành viên
                      </span>
                    </label>
                  </div>
                )}
              />

              {errors.needsMemberSupport && (
                <span className="form-error" style={{ color: "#dc2626", fontSize: 12, marginTop: 8, display: "block" }}>
                  {errors.needsMemberSupport.message}
                </span>
              )}
            </div>
          </div>

          <Button type="submit" size="lg" disabled={isSubmitting} style={{ width: "100%", padding: "16px 24px", fontSize: 16 }}>
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Đang xử lý và gửi hồ sơ ý tưởng...
              </>
            ) : (
              <>
                <Send size={20} />
                Gửi ý tưởng ngay
              </>
            )}
          </Button>

          <p className="form-help" style={{ marginTop: 16, textAlign: "center", fontSize: 13 }}>
            Tác giả / Nhóm trưởng không cần tạo mật khẩu. Sau khi gửi, hệ thống sẽ gửi mã xác minh và liên kết tra cứu vĩnh viễn tới email của bạn.
          </p>
        </form>
      )}
    </div>
  );
}
