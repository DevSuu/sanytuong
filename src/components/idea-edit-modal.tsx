"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  X,
  Edit3,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  User,
  CreditCard,
  Users,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ideaResubmissionSchema,
  IdeaResubmissionInput,
  RESEARCH_FIELDS,
  POPULAR_BANKS,
} from "@/lib/validation/idea-schema";

export interface IdeaEditModalProps {
  idea: {
    id: string;
    referenceCode: string;
    title: string;
    field: string | null;
    description: string;
    expectedProduct: string | null;
    necessity: string | null;
    innovation: string | null;
    feasibility: string | null;
    potential: string | null;
    needsMemberSupport: boolean;
    version: number;
  };
  submitter: {
    fullName: string;
    studentCode: string;
    className: string | null;
    email: string;
    phone: string | null;
    bankAccountNumber: string | null;
    bankName: string | null;
    bankBranch: string | null;
  };
  lookupToken: string;
  latestFeedback?: string | null;
}

export function IdeaEditModal({
  idea,
  submitter,
  lookupToken,
  latestFeedback,
}: IdeaEditModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IdeaResubmissionInput>({
    resolver: zodResolver(ideaResubmissionSchema),
    defaultValues: {
      lookupToken,
      fullName: submitter.fullName || "",
      studentCode: submitter.studentCode || "",
      className: submitter.className || "",
      phone: submitter.phone || "",
      bankName: submitter.bankName || "",
      bankAccountNumber: submitter.bankAccountNumber || "",
      bankBranch: submitter.bankBranch || "",
      field: idea.field || "",
      title: idea.title || "",
      description: idea.description || "",
      expectedProduct: idea.expectedProduct || "",
      necessity: idea.necessity || "",
      innovation: idea.innovation || "",
      feasibility: idea.feasibility || "",
      potential: idea.potential || "",
      needsMemberSupport: Boolean(idea.needsMemberSupport),
    },
  });

  const selectedBankName = watch("bankName");
  const isAgribank =
    selectedBankName?.trim().toLowerCase() === "agribank" ||
    selectedBankName?.trim().toLowerCase().includes("agribank");

  const handleOpen = () => {
    setServerError(null);
    setSuccessMessage(null);
    reset({
      lookupToken,
      fullName: submitter.fullName || "",
      studentCode: submitter.studentCode || "",
      className: submitter.className || "",
      phone: submitter.phone || "",
      bankName: submitter.bankName || "",
      bankAccountNumber: submitter.bankAccountNumber || "",
      bankBranch: submitter.bankBranch || "",
      field: idea.field || "",
      title: idea.title || "",
      description: idea.description || "",
      expectedProduct: idea.expectedProduct || "",
      necessity: idea.necessity || "",
      innovation: idea.innovation || "",
      feasibility: idea.feasibility || "",
      potential: idea.potential || "",
      needsMemberSupport: Boolean(idea.needsMemberSupport),
    });
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setIsOpen(false);
  };

  const onSubmit = async (values: IdeaResubmissionInput) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/ideas/${idea.id}/resubmit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lookup-token": lookupToken,
        },
        body: JSON.stringify(values),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setServerError(
          json.error || "Gửi lại ý tưởng thất bại. Vui lòng thử lại sau.",
        );
        return;
      }

      setSuccessMessage(
        json.message ||
          "Hồ sơ ý tưởng đã được cập nhật và gửi lại thành công!",
      );

      // Refresh server components to show updated status and remove the edit button
      router.refresh();

      setTimeout(() => {
        setIsOpen(false);
      }, 1500);
    } catch {
      setServerError("Lỗi kết nối máy chủ. Vui lòng kiểm tra lại mạng.");
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        id={`btn-edit-idea-${idea.id}`}
        data-testid="edit-idea-trigger"
        onClick={handleOpen}
        style={{
          background: "var(--brand-orange)",
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 600,
          fontSize: 13,
          padding: "4px 12px",
          height: 30,
          borderRadius: 6,
        }}
      >
        <Edit3 size={14} /> Chỉnh sửa ý tưởng
      </Button>

      {isOpen &&
        mounted &&
        createPortal(
          <div
            id="idea-edit-modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              overflowY: "auto",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            <div
              className="form-panel"
              id="idea-edit-modal-content"
              style={{
                width: "100%",
                maxWidth: "880px",
                maxHeight: "92vh",
                overflowY: "auto",
                background: "var(--surface)",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
                padding: "clamp(16px, 4vw, 28px)",
                position: "relative",
              }}
            >
              <button
                type="button"
                id="btn-close-edit-modal"
                onClick={handleClose}
                disabled={isSubmitting}
                style={{
                  position: "absolute",
                  top: 20,
                  right: 20,
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  padding: 4,
                }}
                aria-label="Đóng biểu mẫu"
              >
                <X size={22} />
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingRight: 32, marginBottom: 6 }}>
                <span className="eyebrow" style={{ margin: 0 }}>
                  CHỈNH SỬA & GỬI LẠI HỒ SƠ
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--brand-orange)",
                    background: "rgba(242, 92, 5, 0.1)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                >
                  <Hash size={12} /> {idea.referenceCode}
                </span>
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px 0" }}>
                Chỉnh sửa hồ sơ ý tưởng
              </h2>

              {/* BTC FEEDBACK ALERT */}
              {latestFeedback && (
                <div
                  id="btc-feedback-alert"
                  style={{
                    marginBottom: 24,
                    padding: "16px 18px",
                    borderRadius: "10px",
                    background: "rgba(217, 119, 6, 0.1)",
                    border: "1px solid rgba(217, 119, 6, 0.3)",
                    color: "var(--foreground)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#d97706",
                      fontWeight: 700,
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    <AlertCircle size={17} style={{ flexShrink: 0 }} />
                    <span>Yêu cầu chỉnh sửa từ Ban tổ chức:</span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      color: "var(--foreground)",
                    }}
                  >
                    {latestFeedback}
                  </p>
                </div>
              )}

              {/* SERVER ERROR */}
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

              {/* SUCCESS NOTICE */}
              {successMessage && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: "14px 18px",
                    background: "rgba(22, 163, 74, 0.1)",
                    border: "1px solid rgba(22, 163, 74, 0.3)",
                    borderRadius: "8px",
                    color: "#16a34a",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
                  <span>{successMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* SECTION 1: THÔNG TIN NGƯỜI ĐẠI DIỆN & TÀI KHOẢN */}
                <div style={{ marginBottom: 28 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 8,
                      marginBottom: 16,
                    }}
                  >
                    <User size={18} color="var(--brand-orange)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                      1. Thông tin Người đại diện & Nhận hỗ trợ kinh phí
                    </h3>
                  </div>

                  <div className="form-grid">
                    {/* Họ và tên */}
                    <div className="form-field">
                      <label htmlFor="edit-fullName">Họ và tên người đại diện *</label>
                      <input
                        id="edit-fullName"
                        type="text"
                        autoComplete="name"
                        placeholder="Ví dụ: Nguyễn Văn An"
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
                      <label htmlFor="edit-studentCode">Mã cán bộ / mã sinh viên *</label>
                      <input
                        id="edit-studentCode"
                        type="text"
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

                    {/* Email (Read-only identifier) */}
                    <div className="form-field">
                      <label htmlFor="edit-email">
                        Email liên hệ <span style={{ color: "var(--muted)", fontSize: 12 }}>(Không thể thay đổi)</span>
                      </label>
                      <input
                        id="edit-email"
                        type="email"
                        value={submitter.email}
                        readOnly
                        disabled
                        style={{
                          background: "var(--surface-muted, rgba(148, 163, 184, 0.1))",
                          cursor: "not-allowed",
                          opacity: 0.8,
                        }}
                      />
                    </div>

                    {/* Số điện thoại */}
                    <div className="form-field">
                      <label htmlFor="edit-phone">Số điện thoại *</label>
                      <input
                        id="edit-phone"
                        type="tel"
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
                      <label htmlFor="edit-className">Lớp sinh hoạt</label>
                      <input
                        id="edit-className"
                        type="text"
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
                  <div
                    style={{
                      marginTop: 16,
                      padding: "16px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 12,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--foreground)",
                      }}
                    >
                      <CreditCard size={16} color="var(--brand-orange)" />
                      Tài khoản Ngân hàng (Chi trả kinh phí hỗ trợ & giải thưởng)
                    </div>

                    <div className="form-grid">
                      {/* Tên ngân hàng */}
                      <div className="form-field">
                        <label htmlFor="edit-bankName">Tên ngân hàng *</label>
                        <select
                          id="edit-bankName"
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
                        <label htmlFor="edit-bankAccountNumber">Số tài khoản ngân hàng *</label>
                        <input
                          id="edit-bankAccountNumber"
                          type="text"
                          placeholder="Chỉ nhập chữ số (từ 6 - 25 ký tự)"
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
                        <label htmlFor="edit-bankBranch">
                          Chi nhánh ngân hàng{" "}
                          {isAgribank ? (
                            <strong style={{ color: "#dc2626" }}>* (Bắt buộc với Agribank)</strong>
                          ) : (
                            "(Tùy chọn)"
                          )}
                        </label>
                        <input
                          id="edit-bankBranch"
                          type="text"
                          placeholder={
                            isAgribank
                              ? "Ví dụ: Agribank Chi nhánh Thanh Xuân, Hà Nội"
                              : "Ví dụ: Chi nhánh Cầu Giấy (không bắt buộc)"
                          }
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
                <div style={{ marginBottom: 28 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 8,
                      marginBottom: 16,
                    }}
                  >
                    <Lightbulb size={18} color="var(--brand-orange)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                      2. Nội dung Chi tiết Ý tưởng & Đề tài
                    </h3>
                  </div>

                  <div className="form-grid">
                    {/* Lĩnh vực nghiên cứu */}
                    <div className="form-field full">
                      <label htmlFor="edit-field">Lĩnh vực nghiên cứu *</label>
                      <select
                        id="edit-field"
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
                        {idea.field && !(RESEARCH_FIELDS as readonly string[]).includes(idea.field) && (
                          <option value={idea.field}>{idea.field}</option>
                        )}
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
                      <label htmlFor="edit-title">Tên ý tưởng / đề tài chính thức * <span style={{ fontWeight: 400, fontSize: 12, color: "var(--muted)" }}>(Nhập trực tiếp tên đề tài mới để cập nhật lên dữ liệu)</span></label>
                      <input
                        id="edit-title"
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
                      <label htmlFor="edit-description">Mô tả chi tiết ý tưởng *</label>
                      <textarea
                        id="edit-description"
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
                      <label htmlFor="edit-expectedProduct">Sản phẩm dự kiến *</label>
                      <textarea
                        id="edit-expectedProduct"
                        rows={3}
                        maxLength={3000}
                        placeholder="Ví dụ: Ứng dụng di động iOS/Android, bản mẫu thiết bị IoT, quy trình kỹ thuật..."
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
                      <label htmlFor="edit-necessity">Tính cấp thiết *</label>
                      <textarea
                        id="edit-necessity"
                        rows={3}
                        maxLength={3000}
                        placeholder="Tại sao vấn đề này cần được giải quyết ngay? Thực trạng và mức độ ảnh hưởng..."
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
                      <label htmlFor="edit-innovation">Tính mới & sáng tạo sơ bộ *</label>
                      <textarea
                        id="edit-innovation"
                        rows={3}
                        maxLength={3000}
                        placeholder="Giải pháp của bạn có điểm gì khác biệt, độc đáo so với các sản phẩm hiện có?"
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
                      <label htmlFor="edit-feasibility">Tính khả thi *</label>
                      <textarea
                        id="edit-feasibility"
                        rows={3}
                        maxLength={3000}
                        placeholder="Khả năng hiện thực hóa giải pháp: công nghệ sử dụng, điều kiện cơ sở vật chất, nhân lực..."
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
                      <label htmlFor="edit-potential">Tiềm năng phát triển *</label>
                      <textarea
                        id="edit-potential"
                        rows={3}
                        maxLength={3000}
                        placeholder="Khả năng mở rộng quy mô, ứng dụng trong thực tế doanh nghiệp hoặc thương mại hóa..."
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
                <div style={{ marginBottom: 28 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 8,
                      marginBottom: 16,
                    }}
                  >
                    <Users size={18} color="var(--brand-orange)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                      3. Kế hoạch Nhân sự & Đồng hành
                    </h3>
                  </div>

                  <div
                    style={{
                      padding: "16px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                  >
                    <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 6 }}>
                      Có cần Ban tổ chức hỗ trợ kết nối / bổ sung thành viên ở Vòng 2 không? *
                    </label>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                      Nếu nhóm bạn đang thiếu nhân sự chuyên môn, Ban tổ chức sẽ hỗ trợ kết nối sinh viên phù hợp ở Vòng 2.
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
                            }}
                          >
                            <input
                              id="edit-needsMemberSupportYes"
                              type="radio"
                              name="edit-needsMemberSupportGroup"
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
                            }}
                          >
                            <input
                              id="edit-needsMemberSupportNo"
                              type="radio"
                              name="edit-needsMemberSupportGroup"
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
                      <span
                        className="form-error"
                        style={{ color: "#dc2626", fontSize: 12, marginTop: 8, display: "block" }}
                      >
                        {errors.needsMemberSupport.message}
                      </span>
                    )}
                  </div>
                </div>

                {/* MODAL ACTIONS */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    borderTop: "1px solid var(--border)",
                    paddingTop: 18,
                  }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    Hủy
                  </Button>

                  <Button
                    type="submit"
                    id="btn-submit-resubmit-idea"
                    disabled={isSubmitting}
                    style={{
                      background: "var(--brand-orange)",
                      color: "#fff",
                      fontWeight: 600,
                      minWidth: 160,
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Đang gửi lại...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Gửi lại ý tưởng
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
