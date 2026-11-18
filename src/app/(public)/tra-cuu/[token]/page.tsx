import { getDb } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import {
  hasSubmittedPosterInHistory,
  extractPosterDriveMetadata,
} from "@/lib/google-drive/poster-drive-service";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_BADGES,
} from "@/lib/domain/task-state-machine";
import { AlertCircle, Clock, FileText, Briefcase, Building2, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LookupIdeasWorkspace, LookupWorkspaceIdeaItem } from "@/components/lookup-ideas-workspace";
import { LookupTokenSync } from "@/components/lookup-token-sync";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tra cứu Hồ sơ Đề tài — Thử thách sáng tạo 4.0 UTT",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  referrer: "no-referrer",
};

export default async function PermanentLookupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenH = hashToken(token.trim());
  const db = getDb();

  const credential = await db.lookupCredential.findUnique({
    where: { tokenHash: tokenH },
    include: {
      submitter: {
        include: {
          ideas: {
            orderBy: { createdAt: "desc" },
            include: {
              statusHistory: {
                orderBy: { createdAt: "desc" },
                take: 10,
              },
              projectProfile: {
                include: {
                  members: { orderBy: { orderIndex: "asc" } },
                  editRequests: { orderBy: { createdAt: "desc" } },
                  history: { orderBy: { createdAt: "desc" } },
                },
              },
            },
          },
          taskApplications: {
            orderBy: { createdAt: "desc" },
            include: {
              task: true,
              members: { orderBy: { orderIndex: "asc" } },
              history: { orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
    },
  });

  if (!credential || credential.revokedAt) {
    return (
      <div className="container page-shell" style={{ maxWidth: 680 }}>
        <div className="form-panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <AlertCircle size={56} style={{ margin: "0 auto 16px", color: "#dc2626" }} />
          <h2 style={{ color: "#dc2626" }}>Đường dẫn tra cứu không hợp lệ</h2>
          <p className="page-intro" style={{ marginTop: 8 }}>
            Đường dẫn tra cứu này không tồn tại hoặc đã bị thu hồi vì lý do bảo mật.
          </p>
          <div style={{ marginTop: 24 }}>
            <Button asChild>
              <Link href="/tra-cuu">Gửi lại đường dẫn qua email</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Update lastUsedAt timestamp asynchronously
  db.lookupCredential
    .update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  const { submitter } = credential;

  // Self-healing: if submitter's email is already verified (or they accessed their permanent email lookup link),
  // automatically activate any ideas that were left in PENDING_VERIFICATION from multi-submission batches.
  const pendingIdeasToActivate = submitter.ideas.filter(
    (i) => i.status === "PENDING_VERIFICATION" && Boolean(submitter.emailVerifiedAt),
  );
  if (pendingIdeasToActivate.length > 0) {
    const now = new Date();
    for (const pendingIdea of pendingIdeasToActivate) {
      await db.$transaction([
        db.idea.update({
          where: { id: pendingIdea.id },
          data: {
            status: "SUBMITTED",
            submittedAt: now,
            version: { increment: 1 },
          },
        }),
        db.ideaStatusHistory.create({
          data: {
            ideaId: pendingIdea.id,
            actorType: "SYSTEM",
            oldStatus: "PENDING_VERIFICATION",
            newStatus: "SUBMITTED",
            reason:
              "Tự động kích hoạt hồ sơ do địa chỉ email của người gửi đã được xác minh hợp lệ.",
          },
        }),
      ]);
      pendingIdea.status = "SUBMITTED";
    }
  }

  const { ideas, taskApplications } = submitter;

  return (
    <div className="container page-shell" style={{ maxWidth: 860 }}>
      <LookupTokenSync token={token} />
      <p className="eyebrow">HỒ SƠ CỦA BẠN</p>
      <h1>{submitter.fullName}</h1>
      <p className="page-intro">
        Mã SV / Mã cán bộ: <strong>{submitter.studentCode}</strong>
        {submitter.className?.trim() ? (
          <>
            {" "}
            · Lớp: <strong>{submitter.className}</strong>
          </>
        ) : null}
      </p>

      <div
        className="notice"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderLeft: "4px solid var(--brand-orange)",
          marginBottom: 32,
        }}
      >
        <Clock size={20} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
        <div>
          <strong>Đường dẫn tra cứu cố định:</strong> Đây là liên kết duy nhất gắn liền với email của bạn. Mọi ý tưởng dự thi và đơn đăng ký nhiệm vụ sẽ tự động hiển thị tại trang này.
        </div>
      </div>

      {/* SECTION 1: Ý TƯỞNG DỰ THI (PHASE 2A & 2C) */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "clamp(17px, 4vw, 20px)", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={20} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
          Ý tưởng dự thi của bạn ({ideas.length})
        </h2>

        {ideas.length === 0 ? (
          <div className="form-panel" style={{ width: "100%", textAlign: "center", padding: 40 }}>
            <FileText size={40} style={{ margin: "0 auto 12px", color: "var(--muted)" }} />
            <p>Bạn chưa có ý tưởng nào trong hệ thống.</p>
            <Button asChild style={{ marginTop: 16 }}>
              <Link href="/gui-y-tuong">Gửi ý tưởng ngay</Link>
            </Button>
          </div>
        ) : (
          <LookupIdeasWorkspace
            token={token}
            submitter={{
              fullName: submitter.fullName,
              studentCode: submitter.studentCode,
              className: submitter.className,
              major: submitter.major,
              phone: submitter.phone,
              email: submitter.email,
              bankAccountNumber: submitter.bankAccountNumber,
              bankName: submitter.bankName,
              bankBranch: submitter.bankBranch,
            }}
            ideas={ideas.map((idea): LookupWorkspaceIdeaItem => {
              const latestHistory = idea.statusHistory[0];
              const btcFeedbackHistory = idea.statusHistory.find(
                (h) => h.newStatus === "NEEDS_REVISION" || h.actorType === "ADMIN",
              );
              const feedbackToShow =
                idea.status === "NEEDS_REVISION"
                  ? btcFeedbackHistory?.reason || latestHistory?.reason
                  : latestHistory?.reason;

              return {
                id: idea.id,
                referenceCode: idea.referenceCode,
                title: idea.title,
                description: idea.description,
                field: idea.field,
                expectedProduct: idea.expectedProduct,
                necessity: idea.necessity,
                innovation: idea.innovation,
                feasibility: idea.feasibility,
                potential: idea.potential,
                needsMemberSupport: idea.needsMemberSupport,
                version: idea.version,
                status: idea.status,
                createdAt: idea.createdAt.toISOString(),
                latestFeedback: feedbackToShow,
                wasResubmittedAfterRevision: idea.statusHistory.some(
                  (h) => h.oldStatus === "NEEDS_REVISION",
                ),
                hasPosterSubmitted: hasSubmittedPosterInHistory(
                  idea.projectProfile?.history,
                ),
                projectProfile: idea.projectProfile,
                posterDrive: extractPosterDriveMetadata(
                  idea.projectProfile?.history,
                  idea.referenceCode,
                  idea.projectProfile?.members.find((m) => m.isLeader)?.email ||
                    submitter.email,
                ),
              };
            })}
          />
        )}
      </div>

      {/* SECTION 2: NHIỆM VỤ ĐÃ ĐĂNG KÝ (PHASE 3) */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: "clamp(17px, 4vw, 20px)", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Briefcase size={20} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
            Nhiệm vụ đặt hàng đã đăng ký ({taskApplications.length})
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/nhiem-vu">Xem Sảnh nhiệm vụ</Link>
          </Button>
        </div>

        {taskApplications.length === 0 ? (
          <div className="form-panel" style={{ width: "100%", textAlign: "center", padding: "32px 20px" }}>
            <Briefcase size={36} style={{ margin: "0 auto 10px", color: "var(--muted)" }} />
            <p style={{ margin: 0, color: "var(--muted)" }}>Bạn chưa đăng ký thực hiện nhiệm vụ đặt hàng nào.</p>
            <Button asChild style={{ marginTop: 14 }} size="sm">
              <Link href="/nhiem-vu">Khám phá Sảnh nhiệm vụ</Link>
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {taskApplications.map((app) => {
              const appBadge = APPLICATION_STATUS_BADGES[app.status];
              return (
                <div
                  key={app.id}
                  className="form-panel"
                  style={{
                    width: "100%",
                    padding: "clamp(16px, 4vw, 24px)",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          color: "var(--muted)",
                          marginBottom: 6,
                        }}
                      >
                        <Building2 size={13} />
                        {app.task.orderingOrganization}
                      </span>
                      <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                        <Link
                          href={`/nhiem-vu/${app.task.slug}`}
                          style={{ color: "inherit", textDecoration: "none" }}
                          className="hover:underline"
                        >
                          {app.task.title}
                        </Link>
                      </h3>
                    </div>

                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: "999px",
                        fontSize: 12,
                        fontWeight: 600,
                        background: appBadge.bg,
                        color: appBadge.color,
                        border: `1px solid ${appBadge.border}`,
                      }}
                    >
                      {APPLICATION_STATUS_LABELS[app.status]}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      lineHeight: 1.5,
                      margin: "8px 0 14px 0",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <strong>Đề xuất giải pháp:</strong> {app.proposal}
                  </p>

                  {app.adminFeedback && (
                    <div
                      style={{
                        margin: "12px 0",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        background:
                          app.status === "SELECTED"
                            ? "rgba(22, 163, 74, 0.08)"
                            : "rgba(107, 114, 128, 0.08)",
                        border: `1px solid ${appBadge.border}`,
                        fontSize: 13,
                      }}
                    >
                      <strong>Phản hồi từ Ban tổ chức:</strong> {app.adminFeedback}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                      borderTop: "1px solid var(--border)",
                      paddingTop: 12,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Users size={14} />
                      Đội ngũ: <strong>{app.members.length} thành viên</strong> (
                      {app.members.filter((m) => m.memberType === "STUDENT").length} SV,{" "}
                      {app.members.filter((m) => m.memberType === "ADVISOR").length} GVHD)
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/nhiem-vu/${app.task.slug}`}>Xem chi tiết nhiệm vụ</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
