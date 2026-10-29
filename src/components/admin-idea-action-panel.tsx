"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PlayCircle,
  Loader2,
  AlertCircle,
  Check,
  Trash2,
} from "lucide-react";
import {
  IdeaStatus,
  canTransition,
  requiresReason,
  STATUS_LABELS,
} from "@/lib/domain/idea-state-machine";

interface AdminIdeaActionPanelProps {
  ideaId: string;
  currentStatus: IdeaStatus;
}

export function AdminIdeaActionPanel({
  ideaId,
  currentStatus,
}: AdminIdeaActionPanelProps) {
  const router = useRouter();
  const [selectedTargetStatus, setSelectedTargetStatus] =
    useState<IdeaStatus | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Determine which actions are currently available based on state machine
  const possibleTransitions: {
    status: IdeaStatus;
    label: string;
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
    bg: string;
    color: string;
  }[] = [];

  if (canTransition(currentStatus, IdeaStatus.UNDER_REVIEW)) {
    possibleTransitions.push({
      status: IdeaStatus.UNDER_REVIEW,
      label: "Tiếp nhận xét duyệt",
      icon: PlayCircle,
      bg: "rgba(234, 88, 12, 0.12)",
      color: "#ea580c",
    });
  }

  if (canTransition(currentStatus, IdeaStatus.APPROVED)) {
    possibleTransitions.push({
      status: IdeaStatus.APPROVED,
      label: "Phê duyệt ý tưởng",
      icon: CheckCircle2,
      bg: "rgba(22, 163, 74, 0.12)",
      color: "#16a34a",
    });
  }

  if (canTransition(currentStatus, IdeaStatus.NEEDS_REVISION)) {
    possibleTransitions.push({
      status: IdeaStatus.NEEDS_REVISION,
      label: "Yêu cầu chỉnh sửa",
      icon: AlertTriangle,
      bg: "rgba(217, 119, 6, 0.12)",
      color: "#d97706",
    });
  }

  if (canTransition(currentStatus, IdeaStatus.REJECTED)) {
    possibleTransitions.push({
      status: IdeaStatus.REJECTED,
      label: "Từ chối hồ sơ",
      icon: XCircle,
      bg: "rgba(220, 38, 38, 0.12)",
      color: "#dc2626",
    });
  }

  const handleActionClick = (targetStatus: IdeaStatus) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSelectedTargetStatus(targetStatus);
    setReasonInput("");
  };

  const performTransition = async (targetStatus: IdeaStatus, reason: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/ideas/${ideaId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId,
          expectedOldStatus: currentStatus,
          newStatus: targetStatus,
          reason,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(
          data.error || "Không thể cập nhật trạng thái. Vui lòng thử lại."
        );
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(data.message || "Đã cập nhật trạng thái thành công.");
      setSelectedTargetStatus(null);
      setIsSubmitting(false);

      // Refresh server component to get latest status and history
      router.refresh();
    } catch {
      setErrorMessage("Lỗi kết nối máy chủ. Vui lòng kiểm tra lại mạng.");
      setIsSubmitting(false);
    }
  };

  const handleReasonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetStatus) return;

    const isReasonMandatory = requiresReason(selectedTargetStatus);
    if (isReasonMandatory && !reasonInput.trim()) {
      setErrorMessage("Vui lòng nhập lý do cụ thể để gửi thông báo cho thí sinh.");
      return;
    }

    performTransition(selectedTargetStatus, reasonInput.trim());
  };

  const handleDeleteIdea = async () => {
    if (
      !confirm(
        "Bạn có chắc chắn muốn XÓA VĨNH VIỄN hồ sơ ý tưởng này (bao gồm Hồ sơ Vòng 2 và Tin tuyển dụng liên quan nếu có) không?\nThao tác này không thể hoàn tác."
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/ideas/${ideaId}/status`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Không thể xóa hồ sơ ý tưởng.");
        setIsSubmitting(false);
        return;
      }
      router.push("/quan-tri/y-tuong");
      router.refresh();
    } catch {
      setErrorMessage("Lỗi kết nối khi xóa hồ sơ ý tưởng.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 20,
      }}
    >
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          marginBottom: 12,
          color: "var(--foreground)",
        }}
      >
        Thao tác Quản trị
      </h3>

      {errorMessage && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            backgroundColor: "rgba(22, 163, 74, 0.1)",
            border: "1px solid rgba(22, 163, 74, 0.3)",
            color: "#16a34a",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          <Check size={16} style={{ flexShrink: 0 }} />
          <span>{successMessage}</span>
        </div>
      )}

      {possibleTransitions.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: "var(--muted)",
            padding: "12px 0",
          }}
        >
          Hồ sơ đã đạt trạng thái kết thúc (
          <strong>{STATUS_LABELS[currentStatus]}</strong>). Không còn thao tác
          chuyển trạng thái khả dụng.
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {possibleTransitions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.status}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleActionClick(item.status)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${item.color}`,
                  backgroundColor: item.bg,
                  color: item.color,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  transition: "opacity 0.2s",
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleDeleteIdea}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: "var(--radius)",
            border: "1px solid #fca5a5",
            backgroundColor: "#fee2e2",
            color: "#b91c1c",
            fontSize: 13,
            fontWeight: 600,
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
        >
          <Trash2 size={15} />
          <span>Xóa vĩnh viễn ý tưởng</span>
        </button>
      </div>

      {/* Confirmation & Reason Modal Overlay */}
      {selectedTargetStatus && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              padding: 24,
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
            }}
          >
            <form onSubmit={handleReasonSubmit}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  marginBottom: 8,
                  color:
                    selectedTargetStatus === IdeaStatus.APPROVED
                      ? "#16a34a"
                      : selectedTargetStatus === IdeaStatus.REJECTED
                      ? "#dc2626"
                      : "var(--foreground)",
                }}
              >
                {selectedTargetStatus === IdeaStatus.APPROVED
                  ? "Xác nhận phê duyệt ý tưởng?"
                  : selectedTargetStatus === IdeaStatus.UNDER_REVIEW
                  ? "Xác nhận tiếp nhận xét duyệt?"
                  : selectedTargetStatus === IdeaStatus.REJECTED
                  ? "Xác nhận từ chối hồ sơ ý tưởng?"
                  : "Xác nhận yêu cầu chỉnh sửa ý tưởng?"}
              </div>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--muted)",
                  marginBottom: 14,
                }}
              >
                {selectedTargetStatus === IdeaStatus.APPROVED
                  ? "Bạn có chắc chắn muốn phê duyệt ý tưởng này không? Sau khi xác nhận, hệ thống sẽ gửi email thông báo cho trưởng nhóm và mở khóa chức năng nộp Hồ sơ Vòng 2 cùng Hội chợ ý tưởng."
                  : selectedTargetStatus === IdeaStatus.UNDER_REVIEW
                  ? "Bạn có chắc chắn muốn chuyển hồ sơ ý tưởng này sang trạng thái Đang xét duyệt không?"
                  : "Nội dung lý do bên dưới là bắt buộc, sẽ được ghi vào nhật ký xử lý và gửi qua email tới thí sinh."}
              </p>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "var(--foreground)",
                }}
              >
                {requiresReason(selectedTargetStatus) ? (
                  <>
                    Lý do{" "}
                    {selectedTargetStatus === IdeaStatus.REJECTED
                      ? "từ chối"
                      : "yêu cầu chỉnh sửa"}{" "}
                    <span style={{ color: "#ef4444" }}>*</span>
                  </>
                ) : (
                  "Ghi chú / Nhận xét kèm theo (không bắt buộc)"
                )}
              </div>

              <textarea
                required={requiresReason(selectedTargetStatus)}
                rows={3}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder={
                  requiresReason(selectedTargetStatus)
                    ? "Nhập chi tiết nhận xét, lý do hoặc những điểm cần bổ sung..."
                    : "Nhập ghi chú nhận xét cho nhóm (hoặc để trống)..."
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--input)",
                  color: "var(--foreground)",
                  fontSize: 13,
                  resize: "vertical",
                  marginBottom: 16,
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setSelectedTargetStatus(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    backgroundColor: "transparent",
                    color: "var(--muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (requiresReason(selectedTargetStatus) && !reasonInput.trim())
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 18px",
                    borderRadius: "var(--radius)",
                    border: "none",
                    backgroundColor:
                      selectedTargetStatus === IdeaStatus.APPROVED
                        ? "#16a34a"
                        : selectedTargetStatus === IdeaStatus.REJECTED
                        ? "#dc2626"
                        : "var(--brand-orange)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor:
                      isSubmitting ||
                      (requiresReason(selectedTargetStatus) && !reasonInput.trim())
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      isSubmitting ||
                      (requiresReason(selectedTargetStatus) && !reasonInput.trim())
                        ? 0.6
                        : 1,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <span>
                      {selectedTargetStatus === IdeaStatus.APPROVED
                        ? "Xác nhận phê duyệt"
                        : selectedTargetStatus === IdeaStatus.UNDER_REVIEW
                        ? "Xác nhận tiếp nhận"
                        : "Xác nhận chuyển trạng thái"}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
