"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Trash2,
  Save,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailTypoSuggestion } from "@/components/ui/email-typo-suggestion";
import {
  ProjectProfileStatus,
  MemberType,
  PROFILE_STATUS_LABELS,
  PROFILE_STATUS_BADGES,
  EDIT_REQUEST_STATUS_LABELS,
  EDIT_REQUEST_STATUS_BADGES,
} from "@/lib/domain/profile-state-machine";

export interface LeaderPanelMember {
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

export interface LeaderPanelEditRequest {
  id: string;
  reason: string;
  requestedFields: string[];
  status: string;
  adminNote?: string | null;
  rejectionReason?: string | null;
  allowedFields?: string[];
  createdAt: string | Date;
}

export interface LeaderPanelProfileHistory {
  id: string;
  action: string;
  reason?: string | null;
  createdAt: string | Date;
}

export interface LeaderPanelProfile {
  id: string;
  ideaId: string;
  status: ProjectProfileStatus;
  version: number;
  submittedAt?: string | Date | null;
  completedAt?: string | Date | null;
  members: LeaderPanelMember[];
  editRequests?: LeaderPanelEditRequest[];
  history?: LeaderPanelProfileHistory[];
}

export interface ProjectProfileLeaderPanelProps {
  ideaId: string;
  initialTitle?: string;
  lookupToken: string;
  submitter: {
    fullName: string;
    studentCode: string;
    className: string;
    email: string;
  };
  initialProfile: LeaderPanelProfile | null;
}

export function ProjectProfileLeaderPanel({
  ideaId,
  initialTitle = "",
  lookupToken,
  submitter,
  initialProfile,
}: ProjectProfileLeaderPanelProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<LeaderPanelProfile | null>(initialProfile);
  const [projectTitle, setProjectTitle] = useState<string>(initialTitle);
  const [isEditing, setIsEditing] = useState<boolean>(
    !initialProfile ||
      initialProfile.status === ProjectProfileStatus.NOT_STARTED ||
      initialProfile.status === ProjectProfileStatus.DRAFT ||
      initialProfile.status === ProjectProfileStatus.NEEDS_REVISION,
  );

  // Initialize members: if empty or NOT_STARTED with only Leader, prefill Member #1 as Student Leader + Member #2 as empty Advisor
  const defaultAdvisorSlot: LeaderPanelMember = {
    memberType: MemberType.ADVISOR,
    isLeader: false,
    fullName: "",
    studentCode: "",
    className: "",
    email: "",
    phone: "",
    department: "Khoa Công nghệ thông tin",
  };

  const defaultMembers: LeaderPanelMember[] = [
    {
      memberType: MemberType.STUDENT,
      isLeader: true,
      fullName: submitter.fullName,
      studentCode: submitter.studentCode,
      className: submitter.className,
      email: submitter.email,
      phone: "",
      department: "",
    },
    defaultAdvisorSlot,
  ];

  const [members, setMembers] = useState<LeaderPanelMember[]>(() => {
    if (!profile?.members || profile.members.length === 0) {
      return defaultMembers;
    }
    if (
      profile.status === ProjectProfileStatus.NOT_STARTED &&
      !profile.members.some((m) => m.memberType === MemberType.ADVISOR)
    ) {
      return [...profile.members, defaultAdvisorSlot];
    }
    return profile.members;
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );



  // Edit Request Modal State
  const [showEditRequestDialog, setShowEditRequestDialog] = useState(false);
  const [editRequestReason, setEditRequestReason] = useState("");
  const [editRequestFields, setEditRequestFields] = useState<string[]>([]);
  const [customFieldInput, setCustomFieldInput] = useState("");

  const currentStatus: ProjectProfileStatus = profile?.status || ProjectProfileStatus.NOT_STARTED;
  const badge = PROFILE_STATUS_BADGES[currentStatus];

  // Check if there is an approved edit request allowing edits on a completed profile
  const approvedEditRequest =
    currentStatus === ProjectProfileStatus.COMPLETED
      ? profile?.editRequests?.find(
          (er: LeaderPanelEditRequest) =>
            er.status === "APPROVED" &&
            (!profile.completedAt ||
              new Date(er.createdAt).getTime() >= new Date(profile.completedAt).getTime()),
        )
      : undefined;

  // Handlers for dynamic member list
  const addMember = () => {
    if (members.length >= 10) return;
    setMembers([
      ...members,
      {
        memberType: MemberType.STUDENT,
        isLeader: false,
        fullName: "",
        studentCode: "",
        className: "",
        email: "",
        phone: "",
        department: "",
      },
    ]);
  };

  const removeMember = (index: number) => {
    if (members.length <= 1) return;
    const target = members[index];
    if (target.isLeader) {
      alert("Không thể xóa Trưởng nhóm / Người đại diện.");
      return;
    }
    const updated = members.filter((_, i) => i !== index);
    setMembers(updated);
  };

  const updateMember = (index: number, field: keyof LeaderPanelMember, value: unknown) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };

    // If setting isLeader = true, automatically unset on all others
    if (field === "isLeader" && value === true) {
      for (let i = 0; i < updated.length; i++) {
        if (i !== index) {
          updated[i].isLeader = false;
        }
      }
      // Force role to STUDENT
      updated[index].memberType = MemberType.STUDENT;
    }

    // If setting memberType = ADVISOR, cannot be leader
    if (field === "memberType" && value === MemberType.ADVISOR) {
      if (updated[index].isLeader) {
        updated[index].isLeader = false;
        // make sure someone else is leader or alert
      }
    }

    setMembers(updated);
  };

  // Save Draft
  const handleSaveDraft = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { members };
      if (projectTitle.trim().length > 0) {
        payload.title = projectTitle.trim();
      }
      const res = await fetch(`/api/ideas/${ideaId}/profile/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lookup-token": lookupToken,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Lưu bản nháp thất bại.");
      }
      setProfile(data.data);
      if (data.data?.members && data.data.members.length > 0) {
        setMembers(data.data.members);
      }
      setMessage({ type: "success", text: "Đã lưu bản nháp hồ sơ thành công." });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi lưu bản nháp.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Submit Profile
  const handleSubmitProfile = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { members };
      if (projectTitle.trim().length > 0) {
        payload.title = projectTitle.trim();
      }
      const res = await fetch(`/api/ideas/${ideaId}/profile/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lookup-token": lookupToken,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Nộp hồ sơ thất bại.");
      }
      setProfile(data.data);
      setIsEditing(false);
      setMessage({
        type: "success",
        text: "Hồ sơ đề tài đã được gửi thành công đến Ban tổ chức để xét duyệt.",
      });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi gửi hồ sơ.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Submit Edit Request (for COMPLETED profile)
  const handleSendEditRequest = async () => {
    if (!editRequestReason.trim()) {
      alert("Vui lòng nhập lý do xin chỉnh sửa.");
      return;
    }
    const finalFields = [...editRequestFields];
    if (customFieldInput.trim() && !finalFields.includes(customFieldInput.trim())) {
      finalFields.push(customFieldInput.trim());
    }
    if (finalFields.length === 0) {
      alert("Vui lòng chọn hoặc nhập ít nhất một trường thông tin cần chỉnh sửa.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/profile/edit-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lookup-token": lookupToken,
        },
        body: JSON.stringify({
          reason: editRequestReason,
          requestedFields: finalFields,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gửi yêu cầu thất bại.");
      }
      // Refresh profile data
      const refRes = await fetch(`/api/ideas/${ideaId}/profile`, {
        headers: { "x-lookup-token": lookupToken },
      });
      const refData = await refRes.json();
      if (refData.ok && refData.data?.profile) {
        setProfile(refData.data.profile);
      }
      setShowEditRequestDialog(false);
      setEditRequestReason("");
      setEditRequestFields([]);
      setCustomFieldInput("");
      setMessage({
        type: "success",
        text: "Yêu cầu chỉnh sửa đã được gửi đến Ban tổ chức xét duyệt.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi gửi yêu cầu chỉnh sửa.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 24,
        padding: "clamp(14px, 4vw, 24px)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      {/* Header & Status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={22} style={{ color: "var(--brand-orange)" }} />
          <div>
            <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              HỒ SƠ ĐỀ TÀI & THÀNH VIÊN
            </h4>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Quy mô nhóm: Tối thiểu 2 người (1 SV + 1 GVHD), tối đa 10 người
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "999px",
              fontSize: 12,
              fontWeight: 600,
              background: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.border}`,
            }}
          >
            Trạng thái: {PROFILE_STATUS_LABELS[currentStatus]}
          </span>

          {currentStatus === ProjectProfileStatus.COMPLETED && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditRequestDialog(true)}
              style={{ fontSize: 12 }}
            >
              <Edit3 size={13} style={{ marginRight: 6 }} />
              Yêu cầu chỉnh sửa
            </Button>
          )}

          {!isEditing &&
            (currentStatus === ProjectProfileStatus.NOT_STARTED ||
              currentStatus === ProjectProfileStatus.DRAFT ||
              currentStatus === ProjectProfileStatus.NEEDS_REVISION ||
              approvedEditRequest) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                style={{ fontSize: 12 }}
              >
                <Edit3 size={13} style={{ marginRight: 6 }} />
                Chỉnh sửa hồ sơ
              </Button>
            )}
        </div>
      </div>

      {/* Alert banner if NEEDS_REVISION */}
      {currentStatus === ProjectProfileStatus.NEEDS_REVISION && (
        <div
          style={{
            marginBottom: 20,
            padding: "14px 16px",
            borderRadius: "8px",
            background: "rgba(217, 119, 6, 0.08)",
            border: "1px solid rgba(217, 119, 6, 0.3)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <AlertTriangle size={20} style={{ color: "#d97706", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#d97706", marginBottom: 4 }}>
              Yêu cầu bổ sung từ Ban tổ chức:
            </div>
            <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>
              {profile?.history?.find(
                (h: LeaderPanelProfileHistory) =>
                  h.action === "PROFILE_REVISION_REQUESTED" ||
                  h.action === "PROFILE_NEEDS_REVISION",
              )?.reason || "Vui lòng kiểm tra và bổ sung danh sách thành viên/GVHD."}
            </div>
          </div>
        </div>
      )}

      {/* Approved Edit Request Banner */}
      {approvedEditRequest && currentStatus === ProjectProfileStatus.COMPLETED && (
        <div
          style={{
            marginBottom: 20,
            padding: "14px 16px",
            borderRadius: "8px",
            background: "rgba(22, 163, 74, 0.08)",
            border: "1px solid rgba(22, 163, 74, 0.3)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <CheckCircle2 size={20} style={{ color: "#16a34a", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#16a34a", marginBottom: 4 }}>
              Yêu cầu chỉnh sửa đã được Ban tổ chức chấp thuận:
            </div>
            <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>
              Bạn được phép chỉnh sửa các trường:{" "}
              <strong>
                {approvedEditRequest.allowedFields?.join(", ") ||
                  approvedEditRequest.requestedFields?.join(", ")}
              </strong>
              . Sau khi cập nhật, vui lòng nhấn <strong>[ Gửi lại hồ sơ ]</strong> để Ban tổ chức hoàn tất.
            </div>
          </div>
        </div>
      )}

      {/* Notification Message */}
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

      {/* Member Form or Read-only View */}
      {isEditing ? (
        <div>
          {initialTitle !== undefined && (
            <div
              style={{
                marginBottom: 20,
                padding: "14px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--background)",
              }}
            >
              <label
                htmlFor={`profile-project-title-${ideaId}`}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  display: "block",
                  marginBottom: 6,
                  color: "var(--foreground)",
                }}
              >
                Tên đề tài chính thức *
              </label>
              <input
                id={`profile-project-title-${ideaId}`}
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Nhập tên đề tài chính thức..."
                className="form-input"
                style={{ width: "100%", height: 38, fontSize: 13, padding: "0 12px" }}
                disabled={loading}
              />
              <span style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, display: "block" }}>
                Nếu có điều chỉnh tên đề tài, vui lòng nhập trực tiếp tên đề tài mới hoàn chỉnh tại đây để hệ thống tự động cập nhật lên cơ sở dữ liệu (tuyệt đối không ghi chú kiểu &ldquo;đã sửa lại tên&rdquo;).
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Danh sách thành viên ({members.length} / 10):
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMember}
              disabled={members.length >= 10 || loading}
              style={{ fontSize: 12 }}
            >
              <Plus size={14} style={{ marginRight: 4 }} />
              Thêm thành viên
            </Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {members.map((member, idx) => {
              const isSV = member.memberType === MemberType.STUDENT;

              return (
                <div
                  key={idx}
                  style={{
                    padding: "clamp(12px, 3.5vw, 16px)",
                    borderRadius: "8px",
                    border: member.isLeader
                      ? "2px solid var(--brand-orange)"
                      : "1px solid var(--border)",
                    background: member.isLeader
                      ? "rgba(242, 92, 5, 0.03)"
                      : "var(--background)",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: member.isLeader ? "var(--brand-orange)" : "var(--foreground)",
                        }}
                      >
                        Thành viên #{idx + 1}
                      </span>
                      {member.isLeader && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "var(--brand-orange)",
                            color: "#fff",
                          }}
                        >
                          Trưởng nhóm / Đại diện
                        </span>
                      )}
                    </div>

                    {!member.isLeader && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(idx)}
                        disabled={loading}
                        style={{ color: "#dc2626", height: 28, padding: "0 8px" }}
                      >
                        <Trash2 size={13} style={{ marginRight: 4 }} />
                        Xóa
                      </Button>
                    )}
                  </div>

                  {/* Role Selection */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 16,
                      rowGap: 10,
                      marginBottom: 14,
                      fontSize: 13,
                      alignItems: "center",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name={`role-${idx}`}
                        value={MemberType.STUDENT}
                        checked={isSV}
                        onChange={() => updateMember(idx, "memberType", MemberType.STUDENT)}
                      />
                      <span>Sinh viên</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name={`role-${idx}`}
                        value={MemberType.ADVISOR}
                        checked={!isSV}
                        onChange={() => updateMember(idx, "memberType", MemberType.ADVISOR)}
                      />
                      <span>GVHD (Giảng viên)</span>
                    </label>

                    {isSV && (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginLeft: "auto",
                          cursor: "pointer",
                          color: member.isLeader ? "var(--brand-orange)" : "var(--muted)",
                          fontWeight: member.isLeader ? 700 : 400,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={member.isLeader}
                          onChange={(e) => updateMember(idx, "isLeader", e.target.checked)}
                        />
                        <span>Trưởng nhóm</span>
                      </label>
                    )}
                  </div>

                  {/* Member Input Fields */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label htmlFor={`member-${idx}-fullName`} style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                        Họ và tên *
                      </label>
                      <input
                        id={`member-${idx}-fullName`}
                        data-testid={`member-${idx}-fullName`}
                        type="text"
                        value={member.fullName || ""}
                        onChange={(e) => updateMember(idx, "fullName", e.target.value)}
                        placeholder="Nguyễn Văn A"
                        className="form-input"
                        style={{ width: "100%", height: 36, fontSize: 13, padding: "0 10px" }}
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor={`member-${idx}-email`} style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                        Email *
                      </label>
                      <input
                        id={`member-${idx}-email`}
                        data-testid={`member-${idx}-email`}
                        type="email"
                        value={member.email || ""}
                        onChange={(e) => updateMember(idx, "email", e.target.value)}
                        placeholder="nguyenvana@utt.edu.vn"
                        className="form-input"
                        style={{ width: "100%", height: 36, fontSize: 13, padding: "0 10px" }}
                        required
                      />
                      <EmailTypoSuggestion
                        email={member.email || ""}
                        onAccept={(fixed) => updateMember(idx, "email", fixed)}
                      />
                    </div>

                    {isSV ? (
                      <>
                        <div>
                          <label htmlFor={`member-${idx}-studentCode`} style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                            Mã sinh viên *
                          </label>
                          <input
                            id={`member-${idx}-studentCode`}
                            data-testid={`member-${idx}-studentCode`}
                            type="text"
                            value={member.studentCode || ""}
                            onChange={(e) => updateMember(idx, "studentCode", e.target.value)}
                            placeholder="72DCHT21001"
                            className="form-input"
                            style={{ width: "100%", height: 36, fontSize: 13, padding: "0 10px" }}
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor={`member-${idx}-className`} style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                            Lớp *
                          </label>
                          <input
                            id={`member-${idx}-className`}
                            data-testid={`member-${idx}-className`}
                            type="text"
                            value={member.className || ""}
                            onChange={(e) => updateMember(idx, "className", e.target.value)}
                            placeholder="72DCHT21"
                            className="form-input"
                            style={{ width: "100%", height: 36, fontSize: 13, padding: "0 10px" }}
                            required
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label htmlFor={`member-${idx}-department`} style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                            Khoa / Đơn vị công tác
                          </label>
                          <input
                            id={`member-${idx}-department`}
                            data-testid={`member-${idx}-department`}
                            type="text"
                            value={member.department || ""}
                            onChange={(e) => updateMember(idx, "department", e.target.value)}
                            placeholder="Khoa Công nghệ thông tin"
                            className="form-input"
                            style={{ width: "100%", height: 36, fontSize: 13, padding: "0 10px" }}
                          />
                        </div>

                        <div>
                          <label htmlFor={`member-${idx}-phone`} style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                            Số điện thoại
                          </label>
                          <input
                            id={`member-${idx}-phone`}
                            data-testid={`member-${idx}-phone`}
                            type="tel"
                            value={member.phone || ""}
                            onChange={(e) => updateMember(idx, "phone", e.target.value)}
                            placeholder="0987654321"
                            className="form-input"
                            style={{ width: "100%", height: 36, fontSize: 13, padding: "0 10px" }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 24,
              borderTop: "1px solid var(--border)",
              paddingTop: 16,
            }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={loading}
              style={{ fontSize: 13 }}
            >
              <Save size={14} style={{ marginRight: 6 }} />
              Lưu bản nháp
            </Button>

            <Button
              type="button"
              onClick={handleSubmitProfile}
              disabled={loading}
              style={{ fontSize: 13, backgroundColor: "var(--brand-orange)" }}
            >
              <Send size={14} style={{ marginRight: 6 }} />
              {currentStatus === ProjectProfileStatus.COMPLETED ? "Cập nhật & Nộp lại" : "Gửi hồ sơ cho Ban tổ chức"}
            </Button>
          </div>
        </div>
      ) : (
        /* Read-only Member Table */
        <div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "8px 12px" }}>#</th>
                  <th style={{ padding: "8px 12px" }}>Họ và tên</th>
                  <th style={{ padding: "8px 12px" }}>Vai trò</th>
                  <th style={{ padding: "8px 12px" }}>MSSV / Khoa</th>
                  <th style={{ padding: "8px 12px" }}>Lớp</th>
                  <th style={{ padding: "8px 12px" }}>Email</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: m.isLeader ? "rgba(242, 92, 5, 0.04)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "10px 12px" }}>{idx + 1}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                      {m.fullName}
                      {m.isLeader && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            padding: "2px 6px",
                            background: "var(--brand-orange)",
                            color: "#fff",
                            borderRadius: 4,
                          }}
                        >
                          Trưởng nhóm
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {m.memberType === MemberType.STUDENT ? "Sinh viên" : "GVHD"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {m.memberType === MemberType.STUDENT ? m.studentCode : m.department || "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>{m.className || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{m.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {currentStatus === ProjectProfileStatus.SUBMITTED && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: "8px",
                background: "rgba(2, 132, 199, 0.08)",
                fontSize: 13,
                color: "#0284c7",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Clock size={16} />
              <span>Hồ sơ đã được gửi. Đang chờ Ban tổ chức xem xét và phê duyệt.</span>
            </div>
          )}
        </div>
      )}

      {/* Edit Requests Section */}
      {profile?.editRequests && profile.editRequests.length > 0 && (
        <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <h5 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            Lịch sử yêu cầu chỉnh sửa:
          </h5>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {profile.editRequests.map((er: LeaderPanelEditRequest) => {
              const reqBadge = EDIT_REQUEST_STATUS_BADGES[er.status as keyof typeof EDIT_REQUEST_STATUS_BADGES];
              return (
                <div
                  key={er.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      Ngày yêu cầu: {new Date(er.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: 11,
                        fontWeight: 700,
                        background: reqBadge?.bg,
                        color: reqBadge?.color,
                        border: `1px solid ${reqBadge?.border}`,
                      }}
                    >
                      {EDIT_REQUEST_STATUS_LABELS[er.status as keyof typeof EDIT_REQUEST_STATUS_LABELS]}
                    </span>
                  </div>

                  <div style={{ color: "var(--muted)", marginBottom: 4 }}>
                    <strong>Lý do:</strong> {er.reason}
                  </div>

                  <div style={{ color: "var(--muted)", marginBottom: 4 }}>
                    <strong>Trường xin sửa:</strong> {er.requestedFields?.join(", ")}
                  </div>

                  {er.status === "REJECTED" && er.rejectionReason && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: "rgba(220, 38, 38, 0.08)",
                        color: "#dc2626",
                        fontSize: 12,
                      }}
                    >
                      <strong>Lý do Ban tổ chức từ chối:</strong> {er.rejectionReason}
                    </div>
                  )}

                  {er.status === "APPROVED" && er.allowedFields && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: "rgba(22, 163, 74, 0.08)",
                        color: "#16a34a",
                        fontSize: 12,
                      }}
                    >
                      <strong>Trường được phép chỉnh sửa:</strong> {er.allowedFields.join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Request Dialog / Modal */}
      {showEditRequestDialog && (
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
              padding: "clamp(16px, 4vw, 24px)",
              maxWidth: 500,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700 }}>
              Gửi yêu cầu chỉnh sửa hồ sơ đề tài
            </h4>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              Hồ sơ đã được duyệt hoàn tất. Vui lòng nêu rõ lý do và những trường thông tin cần điều chỉnh để Ban tổ chức phê duyệt quyền chỉnh sửa.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Lý do xin chỉnh sửa *
              </label>
              <textarea
                value={editRequestReason}
                onChange={(e) => setEditRequestReason(e.target.value)}
                placeholder="Ví dụ: Cập nhật lớp của thành viên do chuyển lớp chuyên ngành..."
                className="form-input"
                style={{ width: "100%", height: 80, fontSize: 13, padding: 8 }}
                required
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Chọn các trường thông tin cần chỉnh sửa *
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 8, fontSize: 13 }}>
                {["Tên đề tài", "Lớp thành viên", "Mã sinh viên", "Số điện thoại", "Email thành viên", "Thông tin GVHD", "Danh sách thành viên"].map((field) => {
                  const checked = editRequestFields.includes(field);
                  return (
                    <label key={field} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditRequestFields([...editRequestFields, field]);
                          } else {
                            setEditRequestFields(editRequestFields.filter((f) => f !== field));
                          }
                        }}
                      />
                      <span>{field}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditRequestDialog(false)}
                disabled={loading}
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                onClick={handleSendEditRequest}
                disabled={loading}
                style={{ backgroundColor: "var(--brand-orange)" }}
              >
                Gửi yêu cầu
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
