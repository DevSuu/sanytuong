"use client";
import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Users,
  Send,
  Save,
  ShieldCheck,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailTypoSuggestion } from "@/components/ui/email-typo-suggestion";

export interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    id: string;
    title: string;
    slug: string;
    orderingOrganization: string;
    applicationDeadline?: string | null;
  };
  initialSubmitter?: {
    fullName: string;
    studentCode?: string | null;
    className?: string | null;
    email: string;
    phone?: string | null;
    major?: string | null;
  } | null;
  existingApplication?: {
    id: string;
    proposal: string;
    status: string;
    members: Array<{
      id?: string;
      memberType: "STUDENT" | "ADVISOR";
      isLeader: boolean;
      fullName: string;
      studentCode?: string | null;
      className?: string | null;
      email: string;
      phone?: string | null;
      department?: string | null;
    }>;
  } | null;
  lookupToken?: string | null;
  onSuccess: (result: {
    applicationId: string;
    application?: unknown;
    lookupToken?: string | null;
    lookupUrl?: string | null;
  }) => void;
}

interface MemberState {
  memberType: "STUDENT" | "ADVISOR";
  isLeader: boolean;
  fullName: string;
  studentCode: string;
  className: string;
  email: string;
  phone: string;
  department: string;
}

function getEmptyAdvisor(): MemberState {
  return {
    memberType: "ADVISOR",
    isLeader: false,
    fullName: "",
    studentCode: "",
    className: "",
    email: "",
    phone: "",
    department: "",
  };
}

function getEmptyStudent(): MemberState {
  return {
    memberType: "STUDENT",
    isLeader: false,
    fullName: "",
    studentCode: "",
    className: "",
    email: "",
    phone: "",
    department: "",
  };
}

export function TaskApplicationModal({
  isOpen,
  onClose,
  task,
  initialSubmitter,
  existingApplication,
  lookupToken,
  onSuccess,
}: TaskModalProps) {
  const leaderMem = existingApplication?.members.find((m) => m.isLeader);

  // Leader info
  const [fullName, setFullName] = useState(
    () => leaderMem?.fullName || initialSubmitter?.fullName || ""
  );
  const [studentCode, setStudentCode] = useState(
    () => leaderMem?.studentCode || initialSubmitter?.studentCode || ""
  );
  const [className, setClassName] = useState(
    () => leaderMem?.className || initialSubmitter?.className || ""
  );
  const [email, setEmail] = useState(
    () => leaderMem?.email || initialSubmitter?.email || ""
  );
  const [phone, setPhone] = useState(
    () => leaderMem?.phone || initialSubmitter?.phone || ""
  );
  const [major, setMajor] = useState(
    () => initialSubmitter?.major || ""
  );
  const [proposal, setProposal] = useState(
    () => existingApplication?.proposal || ""
  );

  // Additional members (index 0 is leader in submitted payload)
  const [otherMembers, setOtherMembers] = useState<MemberState[]>(() => {
    if (existingApplication?.members) {
      const others = existingApplication.members
        .filter((m) => !m.isLeader)
        .map((m) => ({
          memberType: m.memberType,
          isLeader: false,
          fullName: m.fullName || "",
          studentCode: m.studentCode || "",
          className: m.className || "",
          email: m.email || "",
          phone: m.phone || "",
          department: m.department || "",
        }));
      if (others.length > 0) return others;
    }
    return [getEmptyAdvisor()];
  });

  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP Verification state
  const [step, setStep] = useState<"FORM" | "OTP">("FORM");
  const [pendingAppId, setPendingAppId] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpLoading, setOtpLoading] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const addMember = (type: "STUDENT" | "ADVISOR") => {
    if (1 + otherMembers.length >= 10) return;
    setOtherMembers([
      ...otherMembers,
      type === "ADVISOR" ? getEmptyAdvisor() : getEmptyStudent(),
    ]);
  };

  const removeMember = (index: number) => {
    setOtherMembers(otherMembers.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof MemberState, value: string) => {
    const updated = [...otherMembers];
    updated[index] = { ...updated[index], [field]: value };
    setOtherMembers(updated);
  };

  // Compile full members list: Leader (index 0) + other members
  const allMembers = [
    {
      memberType: "STUDENT" as const,
      isLeader: true,
      fullName: fullName.trim(),
      studentCode: studentCode.trim().toUpperCase(),
      className: className.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      department: major.trim() || null,
    },
    ...otherMembers.map((m) => ({
      memberType: m.memberType,
      isLeader: false,
      fullName: m.fullName.trim(),
      studentCode:
        m.memberType === "STUDENT" ? m.studentCode.trim().toUpperCase() : null,
      className: m.memberType === "STUDENT" ? m.className.trim() : null,
      email: m.email.trim().toLowerCase(),
      phone: m.phone.trim() || null,
      department: m.department.trim() || null,
    })),
  ];

  // Client-side rule indicators
  const totalCount = allMembers.length;
  const studentCount = allMembers.filter((m) => m.memberType === "STUDENT").length;
  const advisorCount = allMembers.filter((m) => m.memberType === "ADVISOR").length;

  const countValid = totalCount >= 2 && totalCount <= 10;
  const hasAdvisor = advisorCount >= 1;
  const hasStudent = studentCount >= 1;

  // Duplicate checks
  const emails = allMembers.map((m) => m.email).filter(Boolean);
  const duplicateEmails = emails.some((e, idx) => emails.indexOf(e) !== idx);
  const studentCodes = allMembers
    .filter((m) => m.memberType === "STUDENT")
    .map((m) => m.studentCode)
    .filter(Boolean);
  const duplicateCodes = studentCodes.some((c, idx) => studentCodes.indexOf(c) !== idx);
  const noDuplicates = !duplicateEmails && !duplicateCodes;

  const canSubmit = countValid && hasAdvisor && hasStudent && noDuplicates;

  async function handleSaveDraft() {
    setDraftLoading(true);
    setError(null);
    try {
      const payload = {
        proposal,
        fullName,
        studentCode,
        className,
        email,
        phone: phone || null,
        major: major || null,
        members: allMembers,
        lookupToken: lookupToken || null,
      };

      const res = await fetch(`/api/tasks/${task.slug}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không thể lưu bản nháp.");
        return;
      }

      onSuccess({
        applicationId: data.applicationId,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi mạng khi lưu bản nháp.");
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleSubmitOfficial(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setError("Vui lòng đáp ứng đầy đủ quy tắc nhóm (tối thiểu 2-10 người, >=1 SV, >=1 GVHD, không trùng lặp).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        proposal,
        fullName,
        studentCode,
        className,
        email,
        phone: phone || null,
        major: major || null,
        members: allMembers,
        lookupToken: lookupToken || null,
      };

      const res = await fetch(`/api/tasks/${task.slug}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không thể nộp hồ sơ đăng ký.");
        return;
      }

      setPendingAppId(data.applicationId);
      setStep("OTP");
      setResendCooldown(60);
      setOtpCode("");
      setOtpError(null);
      setOtpSuccessMsg(data.message || "Đã gửi mã xác thực 6 số tới email của bạn.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi mạng khi nộp hồ sơ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode || !/^\d{6}$/.test(otpCode.trim())) {
      setOtpError("Vui lòng nhập đúng 6 chữ số mã xác thực OTP.");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch(
        `/api/tasks/${task.slug}/applications/${pendingAppId}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otp: otpCode.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || "Mã xác thực không hợp lệ.");
        return;
      }
      onSuccess({
        applicationId: pendingAppId,
        application: data.application,
        lookupToken: data.lookupToken || lookupToken || null,
        lookupUrl: data.lookupUrl || null,
      });
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Lỗi mạng khi xác thực.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || otpLoading) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch(
        `/api/tasks/${task.slug}/applications/${pendingAppId}/resend-otp`,
        {
          method: "POST",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || "Không thể gửi lại mã xác thực.");
        return;
      }
      setOtpSuccessMsg(data.message || "Đã gửi lại mã xác thực mới tới email của bạn.");
      setResendCooldown(60);
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Lỗi mạng khi gửi lại mã.");
    } finally {
      setOtpLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
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
    >
      <div
        className="form-panel"
        style={{
          width: "100%",
          maxWidth: "880px",
          maxHeight: "90vh",
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
          onClick={onClose}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "none",
            border: "none",
            color: "var(--muted)",
            cursor: "pointer",
            padding: 4,
          }}
          aria-label="Đóng"
        >
          <X size={22} />
        </button>

        <p className="eyebrow" style={{ marginBottom: 4, paddingRight: 32 }}>
          ĐĂNG KÝ THỰC HIỆN NHIỆM VỤ
        </p>
        <h2 style={{ fontSize: "clamp(18px, 4.5vw, 22px)", fontWeight: 700, margin: "0 0 4px 0", paddingRight: 32, overflowWrap: "anywhere" }}>
          {task.title}
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
          Đơn vị đặt hàng: <strong>{task.orderingOrganization}</strong>
        </p>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              background: "rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(220, 38, 38, 0.25)",
              color: "#dc2626",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {step === "OTP" ? (
          <div style={{ padding: "20px 0" }}>
            <div
              style={{
                textAlign: "center",
                padding: "24px 20px",
                borderRadius: "12px",
                background: "rgba(2, 132, 199, 0.05)",
                border: "1px solid rgba(2, 132, 199, 0.2)",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: "rgba(2, 132, 199, 0.15)",
                  color: "#0284c7",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Mail size={28} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px 0" }}>
                Xác thực quyền sở hữu Email
              </h3>
              <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 auto", maxWidth: 480, lineHeight: 1.5 }}>
                Hệ thống đã gửi mã xác thực 6 chữ số tới email: <strong style={{ color: "var(--foreground)" }}>{email}</strong>.
                Vui lòng nhập mã để hoàn tất đăng ký chính thức tới Ban tổ chức.
              </p>
            </div>

            {otpError && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#dc2626",
                  fontSize: 14,
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{otpError}</span>
              </div>
            )}

            {otpSuccessMsg && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "rgba(22, 163, 74, 0.1)",
                  border: "1px solid rgba(22, 163, 74, 0.25)",
                  color: "#166534",
                  fontSize: 14,
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CheckCircle2 size={16} />
                <span>{otpSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} style={{ maxWidth: 380, margin: "0 auto", textAlign: "center" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
                MÃ XÁC THỰC (6 CHỮ SỐ)
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoFocus
                style={{
                  width: "100%",
                  textAlign: "center",
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: 10,
                  padding: "12px",
                  borderRadius: 10,
                  border: "2px solid var(--border)",
                  background: "var(--background)",
                  color: "var(--foreground)",
                  fontFamily: "monospace",
                  outline: "none",
                  marginBottom: 16,
                }}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <Button
                  type="submit"
                  disabled={otpLoading || otpCode.trim().length !== 6}
                  style={{
                    background: "var(--brand-orange)",
                    color: "#fff",
                    fontWeight: 700,
                    padding: "12px",
                    width: "100%",
                  }}
                >
                  {otpLoading ? "Đang xác thực..." : "Xác nhận & Nộp hồ sơ"}
                </Button>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("FORM");
                      setOtpError(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      fontSize: 13,
                      cursor: "pointer",
                      padding: 4,
                      textDecoration: "underline",
                    }}
                  >
                    Quay lại chỉnh sửa hồ sơ
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || otpLoading}
                    onClick={handleResendOtp}
                    style={{
                      background: "none",
                      border: "none",
                      color: resendCooldown > 0 ? "var(--muted)" : "#0284c7",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                      padding: 4,
                    }}
                  >
                    {resendCooldown > 0 ? `Gửi lại mã (${resendCooldown}s)` : "Gửi lại mã OTP"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={handleSubmitOfficial}>
          {/* SECTION: THÔNG TIN TRƯỞNG NHÓM (STUDENT LEADER) */}
          <div
            style={{
              padding: "clamp(14px, 3.5vw, 18px) clamp(14px, 4vw, 20px)",
              borderRadius: "12px",
              background: "rgba(242, 92, 5, 0.04)",
              border: "1px solid rgba(242, 92, 5, 0.2)",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--brand-orange)",
                }}
              >
                <ShieldCheck size={18} />
                Trưởng nhóm / Người đại diện (Sinh viên)
              </h3>
              <span
                style={{
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: "var(--brand-orange)",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                LEADER · STUDENT
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                gap: 14,
              }}
            >
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                  placeholder="Nguyễn Văn A"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Mã sinh viên (MSSV) *
                </label>
                <input
                  type="text"
                  required
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                  className="input-field"
                  placeholder="71DCTT21"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Lớp sinh hoạt *
                </label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="input-field"
                  placeholder="71DCTT21"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Email liên hệ *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="sinhvien@utt.edu.vn"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
                <EmailTypoSuggestion
                  email={email}
                  onAccept={(fixed) => setEmail(fixed)}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                  placeholder="0912345678"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Khoa / Chuyên ngành
                </label>
                <input
                  type="text"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="input-field"
                  placeholder="Khoa Công nghệ thông tin"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>
            </div>
          </div>

          {/* SECTION: ĐỀ XUẤT GIẢI PHÁP THỰC HIỆN */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 14, fontWeight: 700, display: "block", marginBottom: 6 }}>
              Đề xuất giải pháp và phương án thực hiện bài toán *
            </label>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px 0" }}>
              Nêu rõ ý tưởng công nghệ, lộ trình thực hiện, năng lực nhóm và kết quả kỳ vọng đạt được.
            </p>
            <textarea
              required
              rows={4}
              value={proposal}
              onChange={(e) => setProposal(e.target.value)}
              placeholder="Trình bày tóm tắt giải pháp kỹ thuật, phân công nhân sự và cam kết tiến độ..."
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* SECTION: THÀNH VIÊN NHÓM VÀ GVHD */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Users size={18} />
                  Thành viên nhóm & Cố vấn ({totalCount}/10 người)
                </h3>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0 0" }}>
                  Bắt buộc: Tối thiểu 2 đến 10 người, có ít nhất 1 Sinh viên và 1 Giảng viên hướng dẫn (GVHD).
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addMember("STUDENT")}
                  disabled={totalCount >= 10}
                >
                  <Plus size={14} /> Thêm Sinh viên
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addMember("ADVISOR")}
                  disabled={totalCount >= 10}
                >
                  <Plus size={14} /> Thêm GVHD
                </Button>
              </div>
            </div>

            {/* Validation Badges */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 16,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontWeight: 600,
                  background: countValid ? "rgba(22, 163, 74, 0.12)" : "rgba(220, 38, 38, 0.12)",
                  color: countValid ? "#16a34a" : "#dc2626",
                }}
              >
                {countValid ? "✓ Số lượng hợp lệ (2–10)" : `✗ Cần 2–10 người (hiện có: ${totalCount})`}
              </span>

              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontWeight: 600,
                  background: hasAdvisor ? "rgba(22, 163, 74, 0.12)" : "rgba(220, 38, 38, 0.12)",
                  color: hasAdvisor ? "#16a34a" : "#dc2626",
                }}
              >
                {hasAdvisor ? `✓ Có ${advisorCount} GVHD` : "✗ Chưa có Giảng viên hướng dẫn (GVHD)"}
              </span>

              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontWeight: 600,
                  background: noDuplicates ? "rgba(22, 163, 74, 0.12)" : "rgba(220, 38, 38, 0.12)",
                  color: noDuplicates ? "#16a34a" : "#dc2626",
                }}
              >
                {noDuplicates ? "✓ Không trùng lặp" : "✗ Có thành viên trùng email hoặc MSSV"}
              </span>
            </div>

            {/* Members List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {otherMembers.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background:
                      m.memberType === "ADVISOR"
                        ? "rgba(14, 165, 233, 0.04)"
                        : "rgba(248, 250, 252, 0.5)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                      <select
                        value={m.memberType}
                        onChange={(e) =>
                          updateMember(
                            idx,
                            "memberType",
                            e.target.value as "STUDENT" | "ADVISOR"
                          )
                        }
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          border: "1px solid var(--border)",
                          background: m.memberType === "ADVISOR" ? "#e0f2fe" : "#f1f5f9",
                          color: m.memberType === "ADVISOR" ? "#0369a1" : "#334155",
                          maxWidth: "100%",
                        }}
                      >
                        <option value="STUDENT">Sinh viên</option>
                        <option value="ADVISOR">Giảng viên hướng dẫn (GVHD)</option>
                      </select>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        Thành viên #{idx + 2}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeMember(idx)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#dc2626",
                        cursor: "pointer",
                        padding: 4,
                      }}
                      title="Xóa thành viên"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                      gap: 10,
                    }}
                  >
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Họ và tên *"
                        value={m.fullName}
                        onChange={(e) => updateMember(idx, "fullName", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 6,
                          fontSize: 13,
                          border: "1px solid var(--border)",
                        }}
                      />
                    </div>

                    <div>
                      <input
                        type="email"
                        required
                        placeholder="Email *"
                        value={m.email}
                        onChange={(e) => updateMember(idx, "email", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 6,
                          fontSize: 13,
                          border: "1px solid var(--border)",
                        }}
                      />
                      <EmailTypoSuggestion
                        email={m.email || ""}
                        onAccept={(fixed) => updateMember(idx, "email", fixed)}
                      />
                    </div>

                    {m.memberType === "STUDENT" ? (
                      <>
                        <div>
                          <input
                            type="text"
                            required
                            placeholder="Mã sinh viên (MSSV) *"
                            value={m.studentCode}
                            onChange={(e) =>
                              updateMember(idx, "studentCode", e.target.value.toUpperCase())
                            }
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              borderRadius: 6,
                              fontSize: 13,
                              border: "1px solid var(--border)",
                            }}
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            required
                            placeholder="Lớp sinh hoạt *"
                            value={m.className}
                            onChange={(e) =>
                              updateMember(idx, "className", e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              borderRadius: 6,
                              fontSize: 13,
                              border: "1px solid var(--border)",
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <input
                            type="text"
                            placeholder="Khoa / Bộ môn công tác"
                            value={m.department}
                            onChange={(e) =>
                              updateMember(idx, "department", e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              borderRadius: 6,
                              fontSize: 13,
                              border: "1px solid var(--border)",
                            }}
                          />
                        </div>
                        <div>
                          <input
                            type="tel"
                            placeholder="Số điện thoại"
                            value={m.phone}
                            onChange={(e) => updateMember(idx, "phone", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              borderRadius: 6,
                              fontSize: 13,
                              border: "1px solid var(--border)",
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ACTIONS */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              gap: 12,
              borderTop: "1px solid var(--border)",
              paddingTop: 18,
            }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={loading || draftLoading}
            >
              <Save size={16} /> {draftLoading ? "Đang lưu..." : "Lưu bản nháp"}
            </Button>

            <Button
              type="submit"
              disabled={loading || draftLoading || !canSubmit}
              style={{ background: "var(--brand-orange)", color: "#fff" }}
            >
              <Send size={16} />{" "}
              {loading
                ? "Đang gửi hồ sơ..."
                : existingApplication
                ? "Cập nhật hồ sơ đăng ký"
                : "Nộp hồ sơ chính thức"}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
