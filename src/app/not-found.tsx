import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "radial-gradient(680px 520px at 50% 30%, rgba(14, 165, 233, 0.14) 0%, transparent 72%), linear-gradient(180deg, #0b1424 0%, #071936 60%, #0b1424 100%)",
        color: "#edf3ff",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          background: "rgba(22, 34, 56, 0.92)",
          border: "1.5px solid rgba(251, 146, 60, 0.4)",
          borderRadius: 24,
          padding: "42px 32px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 800,
            color: "#fb923c",
            background: "rgba(242, 92, 5, 0.15)",
            border: "1px solid rgba(251, 146, 60, 0.35)",
            padding: "5px 14px",
            borderRadius: 99,
            marginBottom: 16,
            letterSpacing: "0.04em",
          }}
        >
          🔥 THỬ THÁCH SÁNG TẠO 4.0 • UTT
        </div>

        <div
          style={{
            fontSize: "clamp(56px, 10vw, 84px)",
            fontWeight: 900,
            lineHeight: 1.05,
            background: "linear-gradient(135deg, #fb923c 0%, #38bdf8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 12,
          }}
        >
          404
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#ffffff",
            marginBottom: 10,
          }}
        >
          Không tìm thấy trang bạn yêu cầu
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "#cbd5e1",
            lineHeight: 1.65,
            marginBottom: 28,
          }}
        >
          Đường dẫn này không tồn tại hoặc đã được thay đổi trong hệ thống cổng thông tin
          Thử thách Sáng tạo 4.0 — Trường Đại học Công nghệ Giao thông vận tải.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 44,
              padding: "0 22px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #c2410c 0%, #ea580c 100%)",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 14,
              boxShadow: "0 8px 20px rgba(234, 88, 12, 0.35)",
            }}
          >
            Về Trang chủ UTT &rarr;
          </Link>
          <Link
            href="/tra-cuu"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 44,
              padding: "0 20px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              color: "#f1f5f9",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Tra cứu ý tưởng
          </Link>
        </div>
      </div>
    </div>
  );
}
