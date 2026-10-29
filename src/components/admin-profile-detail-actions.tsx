"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberType, ProjectProfileStatus } from "@/lib/domain/profile-state-machine";

export interface EditRequestItem {
  id: string;
  reason: string;
  requestedFields: string[];
  status: string;
  adminNote?: string | null;
  rejectionReason?: string | null;
  allowedFields?: string[];
  createdAt: string | Date;
}

export interface AdminProfileMemberItem {
  id?: string;
  memberType: MemberType;
  isLeader: boolean;
  fullName: string;
  studentCode?: string | null;
  className?: string | null;
  email: string;
  phone?: string | null;
  department?: string | null;
  orderIndex?: number;
}

export interface AdminProfileDetailActionsProps {
  profileId: string;
  currentTitle?: string;
  status: ProjectProfileStatus;
  currentMembers: AdminProfileMemberItem[];
  editRequests: EditRequestItem[];
}

export function AdminProfileDetailActions({
  profileId,
  currentTitle = "",
  status,
  currentMembers,
  editRequests,
}: AdminProfileDetailActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  // Approve Confirm Modal State
  const [showApproveConfirmDialog, setShowApproveConfirmDialog] = useState(false);

  // Revision Modal State
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");

  // Direct Edit Modal State
  const [showDirectEditDialog, setShowDirectEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState<string>(currentTitle);
  const [editMembers, setEditMembers] = useState<AdminProfileMemberItem[]>(currentMembers);
  const [directEditReason, setDirectEditReason] = useState("");

  // Reject Edit Request State
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Complete Profile (Approve)
  const handleApproveProfile = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Phê duyệt thất bại.");
      setShowApproveConfirmDialog(false);
      setMessage({ type: "success", text: "Đã phê duyệt hoàn tất hồ sơ đề tài!" });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi duyệt hồ sơ.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Request Revision
  const handleSendRevision = async () => {
    if (!revisionReason.trim()) {
      alert("Bắt buộc phải nhập lý do yêu cầu bổ sung.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_REVISION",
          reason: revisionReason,
          revisionReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Gửi yêu cầu bổ sung thất bại.");
      setShowRevisionDialog(false);
      setRevisionReason("");
      setMessage({ type: "success", text: "Đã gửi yêu cầu bổ sung thông tin hồ sơ cho trưởng nhóm!" });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi gửi yêu cầu.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Save Direct Edit
  const handleSaveDirectEdit = async () => {
    if (!directEditReason.trim()) {
      alert("Bắt buộc phải nhập lý do chỉnh sửa trực tiếp cho audit log.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() ? editTitle.trim() : undefined,
          members: editMembers,
          reason: directEditReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Lưu chỉnh sửa thất bại.");
      setShowDirectEditDialog(false);
      setDirectEditReason("");
      setMessage({ type: "success", text: "Đã cập nhật hồ sơ trực tiếp và lưu lịch sử audit log." });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi lưu chỉnh sửa.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Approve Edit Request
  const handleApproveEditRequest = async (requestId: string, requestedFields: string[]) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn phê duyệt yêu cầu chỉnh sửa hồ sơ cho các trường (${requestedFields.join(", ")}) không?`
      )
    ) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/edit-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE",
          allowedFields: requestedFields,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Phê duyệt yêu cầu thất bại.");
      setMessage({ type: "success", text: "Đã chấp thuận yêu cầu chỉnh sửa hồ sơ." });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi duyệt yêu cầu.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Reject Edit Request
  const handleRejectEditRequest = async () => {
    if (!rejectionReason.trim()) {
      alert("Bắt buộc phải nhập lý do từ chối yêu cầu.");
      return;
    }
    if (!rejectRequestId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/edit-requests/${rejectRequestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          rejectionReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Từ chối yêu cầu thất bại.");
      setRejectRequestId(null);
      setRejectionReason("");
      setMessage({ type: "success", text: "Đã từ chối yêu cầu chỉnh sửa và gửi thông báo qua email." });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi từ chối yêu cầu.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  const pendingRequests = editRequests.filter((er) => er.status === "PENDING");

  return (
    <div>
      {/* Feedback Alert */}
      {message && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: "6px",
            fontSize: 13,
            background:
              message.type === "success"
                ? "rgba(22, 163, 74, 0.1)"
                : "rgba(220, 38, 38, 0.1)",
            color: message.type === "success" ? "#16a34a" : "#dc2626",
            border: `1px solid ${
              message.type === "success"
                ? "rgba(22, 163, 74, 0.3)"
                : "rgba(220, 38, 38, 0.3)"
            }`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Main Action Buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {status === ProjectProfileStatus.SUBMITTED && (
          <>
            <Button
              onClick={() => setShowApproveConfirmDialog(true)}
              disabled={loading}
              style={{ backgroundColor: "#16a34a", fontSize: 13 }}
            >
              <CheckCircle2 size={16} style={{ marginRight: 6 }} />
              Duyệt hoàn tất hồ sơ
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRevisionDialog(true)}
              disabled={loading}
              style={{ borderColor: "#d97706", color: "#d97706", fontSize: 13 }}
            >
              <AlertTriangle size={15} style={{ marginRight: 6 }} />
              Yêu cầu bổ sung thông tin
            </Button>
          </>
        )}

        <Button
          variant="outline"
          onClick={() => {
            setEditTitle(currentTitle);
            setEditMembers([...currentMembers]);
            setShowDirectEditDialog(true);
          }}
          disabled={loading}
          style={{ fontSize: 13 }}
        >
          <Edit3 size={15} style={{ marginRight: 6 }} />
          Chỉnh sửa trực tiếp
        </Button>
      </div>

      {/* Pending Edit Request Actions */}
      {pendingRequests.length > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid rgba(234, 88, 12, 0.3)",
            background: "rgba(234, 88, 12, 0.05)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--brand-orange)" }}>
            ⚡ Có {pendingRequests.length} yêu cầu chỉnh sửa đang chờ phê duyệt:
          </div>
          {pendingRequests.map((er) => (
            <div
              key={er.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                fontSize: 12,
                padding: "8px 0",
                borderTop: "1px dashed var(--border)",
              }}
            >
              <div>
                <strong>Lý do:</strong> {er.reason} | <strong>Trường:</strong> {er.requestedFields.join(", ")}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  size="sm"
                  onClick={() => handleApproveEditRequest(er.id, er.requestedFields)}
                  disabled={loading}
                  style={{ backgroundColor: "#16a34a", fontSize: 11, height: 28 }}
                >
                  Duyệt yêu cầu
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectRequestId(er.id)}
                  disabled={loading}
                  style={{ borderColor: "#dc2626", color: "#dc2626", fontSize: 11, height: 28 }}
                >
                  Từ chối
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Confirm Dialog */}
      {showApproveConfirmDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 460,
              width: "100%",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: 16, fontWeight: 700, color: "#16a34a" }}>
              Xác nhận phê duyệt hoàn tất hồ sơ đề tài?
            </h4>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted)", margin: "0 0 18px 0" }}>
              Bạn có chắc chắn muốn phê duyệt hoàn tất Hồ sơ Vòng 2 này không? Sau khi xác nhận, hồ sơ sẽ được khóa chính thức và thông báo cho trưởng nhóm.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowApproveConfirmDialog(false)}
                disabled={loading}
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                onClick={handleApproveProfile}
                disabled={loading}
                style={{ backgroundColor: "#16a34a" }}
              >
                {loading ? "Đang xử lý..." : "Xác nhận phê duyệt"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Revision Dialog */}
      {showRevisionDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: "100%",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: 16, fontWeight: 700 }}>
              Yêu cầu bổ sung hồ sơ đề tài
            </h4>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px 0" }}>
              Nêu rõ các nội dung cần trưởng nhóm bổ sung (thông tin thành viên, GVHD, lớp, MSSV...).
            </p>
            <textarea
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="Nhập lý do và hướng dẫn bổ sung hồ sơ..."
              className="form-input"
              style={{ width: "100%", height: 100, fontSize: 13, padding: 8, marginBottom: 16 }}
              required
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRevisionDialog(false)}
                disabled={loading}
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                onClick={handleSendRevision}
                disabled={loading}
                style={{ backgroundColor: "#d97706" }}
              >
                Gửi yêu cầu
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Edit Request Dialog */}
      {rejectRequestId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: "100%",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: 16, fontWeight: 700, color: "#dc2626" }}>
              Từ chối yêu cầu chỉnh sửa
            </h4>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px 0" }}>
              Bắt buộc nhập lý do từ chối. Lý do này sẽ được gửi qua email cho trưởng nhóm và hiển thị trên trang tra cứu.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Nhập lý do từ chối yêu cầu..."
              className="form-input"
              style={{ width: "100%", height: 90, fontSize: 13, padding: 8, marginBottom: 16 }}
              required
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectRequestId(null)}
                disabled={loading}
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                onClick={handleRejectEditRequest}
                disabled={loading}
                style={{ backgroundColor: "#dc2626" }}
              >
                Xác nhận từ chối
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Direct Edit Modal */}
      {showDirectEditDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 750,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h4 style={{ margin: "0 0 8px 0", fontSize: 17, fontWeight: 700 }}>
              Admin chỉnh sửa trực tiếp hồ sơ đề tài
            </h4>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px 0" }}>
              Mọi thay đổi sẽ được ghi nhận chi tiết vào audit log với old value và new value.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>
                Tên đề tài chính thức *
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Nhập tên đề tài chính thức..."
                className="form-input"
                style={{ width: "100%", height: 36, fontSize: 13, padding: "0 10px" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {editMembers.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                      #{idx + 1} — {m.memberType === "STUDENT" ? "Sinh viên" : "GVHD"}{" "}
                      {m.isLeader && "(Trưởng nhóm)"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input
                      type="text"
                      value={m.fullName || ""}
                      onChange={(e) => {
                        const updated = [...editMembers];
                        updated[idx].fullName = e.target.value;
                        setEditMembers(updated);
                      }}
                      placeholder="Họ tên"
                      className="form-input"
                      style={{ height: 32, fontSize: 12 }}
                    />
                    <input
                      type="email"
                      value={m.email || ""}
                      onChange={(e) => {
                        const updated = [...editMembers];
                        updated[idx].email = e.target.value;
                        setEditMembers(updated);
                      }}
                      placeholder="Email"
                      className="form-input"
                      style={{ height: 32, fontSize: 12 }}
                    />
                    {m.memberType === "STUDENT" ? (
                      <>
                        <input
                          type="text"
                          value={m.studentCode || ""}
                          onChange={(e) => {
                            const updated = [...editMembers];
                            updated[idx].studentCode = e.target.value;
                            setEditMembers(updated);
                          }}
                          placeholder="Mã sinh viên"
                          className="form-input"
                          style={{ height: 32, fontSize: 12 }}
                        />
                        <input
                          type="text"
                          value={m.className || ""}
                          onChange={(e) => {
                            const updated = [...editMembers];
                            updated[idx].className = e.target.value;
                            setEditMembers(updated);
                          }}
                          placeholder="Lớp"
                          className="form-input"
                          style={{ height: 32, fontSize: 12 }}
                        />
                      </>
                    ) : (
                      <input
                        type="text"
                        value={m.department || ""}
                        onChange={(e) => {
                          const updated = [...editMembers];
                          updated[idx].department = e.target.value;
                          setEditMembers(updated);
                        }}
                        placeholder="Khoa / Đơn vị"
                        className="form-input"
                        style={{ height: 32, fontSize: 12 }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Lý do chỉnh sửa trực tiếp * (Bắt buộc cho audit log)
              </label>
              <textarea
                value={directEditReason}
                onChange={(e) => setDirectEditReason(e.target.value)}
                placeholder="Ví dụ: Điều chỉnh MSSV và Lớp theo danh sách phòng Đào tạo..."
                className="form-input"
                style={{ width: "100%", height: 70, fontSize: 13, padding: 8 }}
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDirectEditDialog(false)}
                disabled={loading}
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                onClick={handleSaveDirectEdit}
                disabled={loading}
                style={{ backgroundColor: "var(--brand-orange)" }}
              >
                <Save size={14} style={{ marginRight: 6 }} />
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
