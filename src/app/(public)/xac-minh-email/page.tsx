"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(Boolean(token));
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "Thiếu mã xác minh trong đường dẫn."
  );
  const [data, setData] = useState<{
    referenceCode?: string;
    referenceCodes?: string[];
    lookupToken?: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    async function verify() {
      try {
        const res = await fetch("/api/ideas/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = await res.json();
        if (!isMounted) return;

        if (result.ok) {
          setSuccess(true);
          setData(result.data);
          if (typeof window !== "undefined" && result.data?.lookupToken) {
            try {
              window.localStorage.setItem("utt_lookup_token", result.data.lookupToken);
            } catch {
              // Ignore storage quota errors
            }
          }
        } else {
          setError(result.error || "Xác minh thất bại.");
        }
      } catch {
        if (isMounted) setError("Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verify();
    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="container page-shell" style={{ maxWidth: 640 }}>
      <div className="form-panel" style={{ textAlign: "center", padding: "48px 24px" }}>
        {loading && (
          <div>
            <Loader2
              className="animate-spin"
              size={48}
              style={{ margin: "0 auto 16px", color: "var(--brand-orange)" }}
            />
            <h2>Đang xác minh địa chỉ email...</h2>
            <p className="page-intro">Vui lòng đợi trong giây lát.</p>
          </div>
        )}

        {!loading && success && (
          <div>
            <CheckCircle2
              size={56}
              style={{ margin: "0 auto 16px", color: "#16a34a" }}
            />
            <h2 style={{ color: "#16a34a" }}>Xác minh thành công!</h2>
            <p className="page-intro" style={{ marginTop: 8 }}>
              Ý tưởng của bạn đã được kích hoạt chính thức và chuyển tới Ban giám khảo cuộc thi.
            </p>
            {(data?.referenceCodes && data.referenceCodes.length > 0
              ? data.referenceCodes
              : data?.referenceCode
                ? [data.referenceCode]
                : []
            ).length > 0 && (
              <div
                style={{
                  margin: "24px 0",
                  padding: "16px",
                  background: "var(--surface)",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  {data?.referenceCodes && data.referenceCodes.length > 1
                    ? `Đã kích hoạt toàn bộ ${data.referenceCodes.length} hồ sơ ý tưởng của bạn:`
                    : "Mã hồ sơ của bạn:"}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--brand-orange)", marginTop: 4 }}>
                  {data?.referenceCodes && data.referenceCodes.length > 1
                    ? data.referenceCodes.join(" · ")
                    : data?.referenceCode}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              {data?.lookupToken ? (
                <Button asChild size="lg">
                  <Link href={`/tra-cuu/${data.lookupToken}`}>
                    Xem trang tra cứu ý tưởng <ArrowRight size={16} />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link href="/tra-cuu">
                    Đến trang tra cứu <ArrowRight size={16} />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {!loading && error && (
          <div>
            <XCircle
              size={56}
              style={{ margin: "0 auto 16px", color: "#dc2626" }}
            />
            <h2 style={{ color: "#dc2626" }}>Xác minh không thành công</h2>
            <p className="page-intro" style={{ marginTop: 8 }}>{error}</p>
            <div style={{ marginTop: 24 }}>
              <Button asChild variant="outline">
                <Link href="/tra-cuu">Quay lại trang tra cứu</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="container page-shell" style={{ textAlign: "center", padding: 60 }}>
          <Loader2 className="animate-spin" size={32} style={{ margin: "auto" }} />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
