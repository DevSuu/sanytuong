"use client";

import React, { useState } from "react";
import {
  Hash,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import {
  IdeaStatus,
  getIdeaDisplayBadge,
} from "@/lib/domain/idea-state-machine";
import { ProjectProfileStatus } from "@/lib/domain/profile-state-machine";
import {
  ProjectProfileLeaderPanel,
  LeaderPanelProfile,
} from "@/components/project-profile-leader-panel";
import { LeaderRecruitmentPanel } from "@/components/leader-recruitment-panel";
import { IdeaEditModal } from "@/components/idea-edit-modal";
import type { PosterDriveMetadata } from "@/lib/google-drive/poster-drive-service";
import { formatVietnamDate } from "@/lib/google-drive/poster-file-utils";

export interface LookupWorkspaceIdeaItem {
  id: string;
  referenceCode: string;
  title: string;
  description: string;
  field: string | null;
  expectedProduct: string | null;
  necessity: string | null;
  innovation: string | null;
  feasibility: string | null;
  potential: string | null;
  needsMemberSupport: boolean;
  version: number;
  status: IdeaStatus;
  createdAt: string | Date;
  latestFeedback?: string | null;
  wasResubmittedAfterRevision: boolean;
  hasPosterSubmitted: boolean;
  projectProfile: LeaderPanelProfile | null;
  posterDrive: PosterDriveMetadata | null;
}

interface LookupIdeasWorkspaceProps {
  ideas: LookupWorkspaceIdeaItem[];
  token: string;
  submitter: {
    fullName: string;
    studentCode: string;
    className: string | null;
    major: string | null;
    phone: string | null;
    email: string;
    bankAccountNumber: string | null;
    bankName: string | null;
    bankBranch: string | null;
  };
}

export function LookupIdeasWorkspace({
  ideas,
  token,
  submitter,
}: LookupIdeasWorkspaceProps) {
  // Default select the first idea that requires action (or the newest idea)
  const defaultSelectedId = (() => {
    const needsAction = ideas.find((i) => {
      if (i.status === "NEEDS_REVISION") return true;
      if (i.status === "APPROVED") {
        const pStatus = i.projectProfile?.status || "NOT_STARTED";
        if (
          pStatus === "NOT_STARTED" ||
          pStatus === "DRAFT" ||
          pStatus === "NEEDS_REVISION"
        ) {
          return true;
        }
        if (pStatus === "COMPLETED" && !i.hasPosterSubmitted) {
          return true;
        }
      }
      return false;
    });
    return needsAction?.id || ideas[0]?.id || "";
  })();

  const [selectedIdeaId, setSelectedIdeaId] = useState<string>(defaultSelectedId);
  const [showProposalDetail, setShowProposalDetail] = useState<boolean>(false);
  const [showRecruitmentBox, setShowRecruitmentBox] = useState<boolean>(false);

  if (ideas.length === 0) {
    return null;
  }

  const activeIdea =
    ideas.find((i) => i.id === selectedIdeaId) || ideas[0];

  const getActionPrompt = (idea: LookupWorkspaceIdeaItem): {
    label: string;
    color: string;
    bg: string;
  } | null => {
    if (idea.status === "NEEDS_REVISION") {
      return {
        label: "⚡ Cần chỉnh sửa thuyết minh Vòng 1",
        color: "#d97706",
        bg: "rgba(217, 119, 6, 0.12)",
      };
    }
    if (idea.status === "APPROVED") {
      const pStatus = idea.projectProfile?.status || "NOT_STARTED";
      if (
        pStatus === "NOT_STARTED" ||
        pStatus === "DRAFT" ||
        pStatus === "NEEDS_REVISION"
      ) {
        return {
          label: "📌 Cần hoàn thiện hồ sơ đội Vòng 2",
          color: "#ea580c",
          bg: "rgba(234, 88, 12, 0.12)",
        };
      }
      if (pStatus === "COMPLETED" && !idea.hasPosterSubmitted) {
        return {
          label: "📤 Cần tải Poster Vòng 2 lên hệ thống",
          color: "#0284c7",
          bg: "rgba(2, 132, 199, 0.12)",
        };
      }
    }
    return null;
  };

  // Compute current step (1..4) for APPROVED ideas
  const getRound2StepState = (idea: LookupWorkspaceIdeaItem) => {
    const pStatus = idea.projectProfile?.status || ProjectProfileStatus.NOT_STARTED;
    const step1Done = idea.status === "APPROVED";
    const step2Done =
      pStatus === ProjectProfileStatus.SUBMITTED ||
      pStatus === ProjectProfileStatus.COMPLETED;
    const step3Done = pStatus === ProjectProfileStatus.COMPLETED;
    const step4Done = step3Done && idea.hasPosterSubmitted;

    let activeStep = 1;
    if (step1Done && !step2Done) activeStep = 2;
    else if (step2Done && !step3Done) activeStep = 3;
    else if (step3Done && !step4Done) activeStep = 4;
    else if (step4Done) activeStep = 5;

    return {
      pStatus,
      step1Done,
      step2Done,
      step3Done,
      step4Done,
      activeStep,
    };
  };

  const activeBadge = getIdeaDisplayBadge(
    activeIdea.status,
    activeIdea.projectProfile?.status,
    activeIdea.hasPosterSubmitted,
  );
  const activePrompt = getActionPrompt(activeIdea);
  const stepState = getRound2StepState(activeIdea);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. IDEA SELECTOR TABS (shown when user has >= 2 ideas, or summary bar) */}
      {ideas.length > 1 && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <span>
              Chọn đề tài để xem &amp; thao tác ({ideas.findIndex((i) => i.id === activeIdea.id) + 1}/{ideas.length} đề tài):
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 500, textTransform: "none" }}>
              Bấm vào từng thẻ mã đề tài bên dưới để chuyển đổi
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 245px), 1fr))",
              gap: 10,
            }}
          >
            {ideas.map((item) => {
              const isSelected = item.id === activeIdea.id;
              const itemBadge = getIdeaDisplayBadge(
                item.status,
                item.projectProfile?.status,
                item.hasPosterSubmitted,
              );
              const prompt = getActionPrompt(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedIdeaId(item.id);
                    setShowProposalDetail(false);
                    setShowRecruitmentBox(false);
                  }}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: isSelected
                      ? "2px solid var(--brand-orange)"
                      : "1px solid var(--border)",
                    background: isSelected
                      ? "rgba(242, 92, 5, 0.06)"
                      : "var(--background)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 6,
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontWeight: 700,
                        fontSize: 12.5,
                        color: isSelected
                          ? "var(--brand-orange)"
                          : "var(--foreground)",
                      }}
                    >
                      {item.referenceCode}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 10.5,
                        fontWeight: 700,
                        background: itemBadge.bg,
                        color: itemBadge.color,
                        border: `1px solid ${itemBadge.border}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {itemBadge.label}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--foreground)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%",
                    }}
                  >
                    {item.title}
                  </div>

                  {prompt && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: prompt.color,
                        background: prompt.bg,
                        padding: "3px 8px",
                        borderRadius: 6,
                        width: "fit-content",
                      }}
                    >
                      {prompt.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. FOCUSED WORKSPACE FOR THE SELECTED IDEA */}
      <div
        key={activeIdea.id}
        className="form-panel"
        style={{
          width: "100%",
          padding: "clamp(16px, 4vw, 26px)",
          borderRadius: 14,
          border: "1.5px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        {/* Top Row: Reference Code + Date + Status Badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13.5,
                fontWeight: 700,
                color: "var(--brand-orange)",
                background: "rgba(242, 92, 5, 0.1)",
                padding: "4px 11px",
                borderRadius: 6,
                fontFamily: "monospace",
              }}
            >
              <Hash size={14} />
              {activeIdea.referenceCode}
            </span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: 12,
                color: "var(--muted)",
                gap: 4,
              }}
            >
              <Calendar size={13} />
              Ngày nộp: {formatVietnamDate(activeIdea.createdAt)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "5px 14px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 700,
                background: activeBadge.bg,
                color: activeBadge.color,
                border: `1px solid ${activeBadge.border}`,
              }}
            >
              {activeBadge.label}
            </span>

            {activeIdea.status === "NEEDS_REVISION" && (
              <IdeaEditModal
                idea={activeIdea}
                submitter={submitter}
                lookupToken={token}
                latestFeedback={activeIdea.latestFeedback}
              />
            )}
          </div>
        </div>

        {/* Idea Title */}
        <h3
          style={{
            fontSize: "clamp(18px, 4vw, 21px)",
            fontWeight: 700,
            margin: "0 0 12px 0",
            lineHeight: 1.35,
            overflowWrap: "anywhere",
          }}
        >
          {activeIdea.title}
        </h3>

        {/* 4-Step Visual Progress Stepper for Approved Ideas */}
        {activeIdea.status === "APPROVED" && (
          <div
            style={{
              margin: "14px 0 18px 0",
              padding: "14px 16px",
              borderRadius: 10,
              background: "var(--background)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Lộ trình thực hiện đề tài {activeIdea.referenceCode}:
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
                gap: 10,
              }}
            >
              {[
                {
                  step: 1,
                  title: "1. Duyệt Ý tưởng Vòng 1",
                  desc: "Đã vượt qua Vòng 1",
                  done: stepState.step1Done,
                  active: stepState.activeStep === 1,
                },
                {
                  step: 2,
                  title: "2. Kê khai Đội thi Vòng 2",
                  desc: stepState.step2Done
                    ? "Đã gửi danh sách đội"
                    : "Điền Thành viên & GVHD",
                  done: stepState.step2Done,
                  active: stepState.activeStep === 2,
                },
                {
                  step: 3,
                  title: "3. BTC Duyệt Hồ sơ Đội",
                  desc: stepState.step3Done
                    ? "Đã duyệt hồ sơ đội"
                    : "Chờ BTC phê duyệt",
                  done: stepState.step3Done,
                  active: stepState.activeStep === 3,
                },
                {
                  step: 4,
                  title: "4. Nộp Poster Vòng 2",
                  desc: stepState.step4Done
                    ? "Đã nộp Poster thành công"
                    : "Tải file Poster trực tiếp trên web",
                  done: stepState.step4Done,
                  active: stepState.activeStep === 4,
                },
              ].map((s) => (
                <div
                  key={s.step}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: s.active
                      ? "1.5px solid var(--brand-orange)"
                      : s.done
                      ? "1px solid rgba(22, 163, 74, 0.35)"
                      : "1px solid var(--border)",
                    background: s.active
                      ? "rgba(242, 92, 5, 0.08)"
                      : s.done
                      ? "rgba(22, 163, 74, 0.06)"
                      : "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: s.active
                        ? "var(--brand-orange)"
                        : s.done
                        ? "#16a34a"
                        : "var(--foreground)",
                    }}
                  >
                    {s.done ? (
                      <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                    ) : null}
                    <span>{s.title}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--muted)",
                      marginTop: 3,
                    }}
                  >
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Prompt Callout only for Round 1 states (when 4-Step Progress Bar is not shown) */}
        {activePrompt && activeIdea.status !== "APPROVED" && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 8,
              background: activePrompt.bg,
              border: `1px solid ${activePrompt.color}`,
              color: activePrompt.color,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>
              Việc cần làm tiếp theo cho đề tài{" "}
              <strong>{activeIdea.referenceCode}</strong>: {activePrompt.label}
            </span>
          </div>
        )}

        {/* Collapsible Round 1 Description (auto-collapsed when APPROVED so Round 2 workspace stays at the top!) */}
        {activeIdea.status === "APPROVED" ? (
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setShowProposalDetail(!showProposalDetail)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--muted)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                maxWidth: "100%",
                textAlign: "left",
              }}
            >
              <FileText size={14} style={{ flexShrink: 0 }} />
              <span>
                {showProposalDetail
                  ? "Thu gọn nội dung thuyết minh ý tưởng Vòng 1"
                  : activeIdea.latestFeedback
                  ? "Xem lại nội dung thuyết minh Vòng 1 & Nhận xét BTC"
                  : "Xem lại nội dung thuyết minh ý tưởng Vòng 1"}
              </span>
              {showProposalDetail ? (
                <ChevronUp size={14} style={{ flexShrink: 0 }} />
              ) : (
                <ChevronDown size={14} style={{ flexShrink: 0 }} />
              )}
            </button>

            {showProposalDetail && (
              <div
                style={{
                  marginTop: 10,
                  padding: "14px 16px",
                  borderRadius: 8,
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                }}
              >
                <p
                  style={{
                    fontSize: 13.5,
                    color: "var(--foreground)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    margin: 0,
                  }}
                >
                  {activeIdea.description}
                </p>
                {activeIdea.latestFeedback && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: "1px dashed var(--border)",
                      fontSize: 12.5,
                      color: "#16a34a",
                    }}
                  >
                    <strong>Phản hồi từ Ban tổ chức:</strong>{" "}
                    {activeIdea.latestFeedback}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <p
              style={{
                fontSize: 14,
                color: "var(--muted)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                margin: 0,
              }}
            >
              {activeIdea.description}
            </p>

            {activeIdea.latestFeedback &&
              (activeIdea.status === "NEEDS_REVISION" ||
                activeIdea.status === "REJECTED") && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    borderRadius: 8,
                    background:
                      activeIdea.status === "NEEDS_REVISION"
                        ? "rgba(217, 119, 6, 0.08)"
                        : "rgba(220, 38, 38, 0.08)",
                    border: `1px solid ${activeBadge.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: activeBadge.color,
                      marginBottom: 4,
                    }}
                  >
                    Phản hồi từ Ban tổ chức:
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--foreground)",
                      lineHeight: 1.5,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {activeIdea.latestFeedback}
                  </div>
                </div>
              )}

            {activeIdea.status === "SUBMITTED" &&
              activeIdea.wasResubmittedAfterRevision && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    borderRadius: 8,
                    background: "rgba(2, 132, 199, 0.08)",
                    border: "1px solid rgba(2, 132, 199, 0.25)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#0284c7",
                      marginBottom: 4,
                    }}
                  >
                    Thông báo từ Hệ thống:
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--foreground)",
                      lineHeight: 1.5,
                    }}
                  >
                    Hồ sơ ý tưởng đã được chỉnh sửa và gửi lại thành công. Đang
                    chờ Ban tổ chức xem xét lại.
                  </div>
                </div>
              )}
          </>
        )}

        {/* ROUND 2 WORKSPACE FOR APPROVED IDEA */}
        {activeIdea.status === "APPROVED" && (
          <div
            id={`ho-so-vong-2-${activeIdea.id}`}
            style={{ scrollMarginTop: 92 }}
          >
            <ProjectProfileLeaderPanel
              key={
                activeIdea.projectProfile?.id
                  ? `${activeIdea.projectProfile.id}-${activeIdea.projectProfile.version}`
                  : activeIdea.id
              }
              ideaId={activeIdea.id}
              referenceCode={activeIdea.referenceCode}
              initialTitle={activeIdea.title}
              lookupToken={token}
              submitter={{
                fullName: submitter.fullName,
                studentCode: submitter.studentCode,
                className: submitter.className ?? "",
                email: submitter.email,
              }}
              initialProfile={activeIdea.projectProfile}
              initialPosterDrive={activeIdea.posterDrive}
            />

            {/* Collapsible Team Recruitment on Idea Fair so it doesn't clutter the page */}
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowRecruitmentBox(!showRecruitmentBox)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px dashed var(--border)",
                  background: "var(--background)",
                  color: "var(--foreground)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} color="var(--brand-orange)" />
                  <span>
                    Tuyển thêm thành viên trên Hội chợ Ý tưởng (Tùy chọn cho đề tài{" "}
                    {activeIdea.referenceCode})
                  </span>
                </span>
                {showRecruitmentBox ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>

              {showRecruitmentBox && (
                <LeaderRecruitmentPanel
                  ideaId={activeIdea.id}
                  lookupToken={token}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
