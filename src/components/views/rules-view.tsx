"use client";

import React from "react";
import {
  BookOpen,
  Users,
  Target,
  Layers,
  Award,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppNavigation } from "@/context/navigation-context";

export function RulesView() {
  const { goToTab } = useAppNavigation();

  return (
    <div className="container page-shell" style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 64 }}>
      {/* Header Section */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <p className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <BookOpen size={15} /> QUY CHẾ & THỂ LỆ CHÍNH THỨC
        </p>
        <h1 style={{ fontSize: "clamp(1.75rem, 5vw, 2.4rem)", fontWeight: 800, margin: "12px 0 16px 0", lineHeight: 1.25 }}>
          Thể Lệ Cuộc Thi Sáng Tạo UTT 4.0
        </h1>
        <p className="page-intro" style={{ maxWidth: 740, margin: "0 auto", fontSize: "1.05rem", color: "var(--muted)" }}>
          Cổng thông tin tổng quan về quy chuẩn tham gia, lĩnh vực trọng tâm, tiêu chí đánh giá và tiến trình tổ chức cuộc thi Thử thách Sáng tạo 4.0 Trường Đại học Công nghệ Giao thông vận tải.
        </p>
      </div>

      {/* Official Disclaimer Banner */}
      <div
        className="notice"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          background: "rgba(242, 92, 5, 0.08)",
          border: "1px solid rgba(242, 92, 5, 0.25)",
          borderLeft: "5px solid var(--brand-orange)",
          borderRadius: 12,
          padding: "18px 20px",
          marginBottom: 40,
        }}
      >
        <AlertCircle size={24} style={{ color: "var(--brand-orange)", flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "var(--foreground)" }}>
          <strong style={{ color: "var(--brand-orange)", display: "block", marginBottom: 4 }}>
            Thông báo từ Ban Tổ chức:
          </strong>
          Bản thể lệ chi tiết, mốc thời hạn nộp bài và hội đồng giám khảo chính thức sẽ được Ban Tổ chức ban hành bằng văn bản hướng dẫn cụ thể. Các nội dung dưới đây tóm lược khung định hướng quy chế chung của cuộc thi. Mọi cập nhật sẽ được công bố trực tiếp trên cổng thông tin này.
        </div>
      </div>

      {/* Grid of Rule Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Section 1: Giới thiệu */}
        <section
          className="form-panel"
          style={{
            width: "100%",
            padding: "clamp(18px, 4vw, 32px)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(242, 92, 5, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--brand-orange)",
              }}
            >
              <BookOpen size={22} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>1. Giới thiệu cuộc thi</h2>
          </div>
          <p style={{ lineHeight: 1.7, color: "var(--muted)", margin: 0 }}>
            Cuộc thi <strong>"Thử thách Sáng tạo 4.0 UTT"</strong> do <strong>Trung tâm Công nghệ BIM & AI</strong> phối hợp tổ chức nhằm thúc đẩy tinh thần đổi mới sáng tạo, nghiên cứu khoa học và ứng dụng công nghệ số trong cộng đồng sinh viên, giảng viên. Cuộc thi kết nối trực tiếp các ý tưởng đột phá của người học với các bài toán thực tiễn từ doanh nghiệp và xã hội.
          </p>
        </section>

        {/* Section 2: Đối tượng tham gia */}
        <section
          className="form-panel"
          style={{
            width: "100%",
            padding: "clamp(18px, 4vw, 32px)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(2, 132, 199, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0284c7",
              }}
            >
              <Users size={22} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>2. Đối tượng tham gia</h2>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, color: "var(--muted)" }}>
            <li>
              <strong>Sinh viên chính quy:</strong> Toàn thể sinh viên, học viên đang theo học tại Trường Đại học Công nghệ Giao thông vận tải.
            </li>
            <li>
              <strong>Hình thức dự thi:</strong> Cá nhân hoặc Nhóm nghiên cứu.
            </li>
            <li>
              <strong>Quy mô nhóm:</strong> Tối đa <strong>10 thành viên</strong> mỗi đề tài (bao gồm 1 Trưởng nhóm đại diện và các thành viên phụ trách các mảng kỹ thuật, thiết kế, kinh doanh).
            </li>
            <li>
              <strong>Giảng viên hướng dẫn:</strong> Mỗi đề tài được khuyến khích có giảng viên hướng dẫn chuyên môn đồng hành.
            </li>
          </ul>
        </section>

        {/* Section 3: Lĩnh vực dự thi */}
        <section
          className="form-panel"
          style={{
            width: "100%",
            padding: "clamp(18px, 4vw, 32px)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(16, 185, 129, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981",
              }}
            >
              <Target size={22} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>3. Lĩnh vực trọng tâm</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 12 }}>
            <div style={{ padding: "16px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
              <strong style={{ display: "block", color: "var(--foreground)", marginBottom: 6 }}>BIM & Công nghệ Xây dựng</strong>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Mô hình thông tin công trình, số hóa hạ tầng, đô thị thông minh và quản lý vòng đời công trình.
              </p>
            </div>
            <div style={{ padding: "16px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
              <strong style={{ display: "block", color: "var(--foreground)", marginBottom: 6 }}>Trí tuệ nhân tạo & CNTT</strong>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Machine Learning, Computer Vision, xử lý ngôn ngữ tự nhiên, IoT và các giải pháp chuyển đổi số.
              </p>
            </div>
            <div style={{ padding: "16px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
              <strong style={{ display: "block", color: "var(--foreground)", marginBottom: 6 }}>Giao thông thông minh (ITS)</strong>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Tối ưu hóa logistics, an toàn giao thông, điều khiển tín hiệu thông minh và phương tiện xanh.
              </p>
            </div>
            <div style={{ padding: "16px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
              <strong style={{ display: "block", color: "var(--foreground)", marginBottom: 6 }}>Đổi mới sáng tạo mở</strong>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Các sáng kiến giải quyết bài toán đặt hàng từ doanh nghiệp đối tác tại Sảnh nhiệm vụ.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Các vòng thi & Tiến trình */}
        <section
          className="form-panel"
          style={{
            width: "100%",
            padding: "clamp(18px, 4vw, 32px)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(139, 92, 246, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8b5cf6",
              }}
            >
              <Layers size={22} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>4. Các vòng thi</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-orange)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                1
              </span>
              <div>
                <strong style={{ display: "block", color: "var(--foreground)", fontSize: "1rem" }}>Vòng 1: Nộp & Sơ loại ý tưởng</strong>
                <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  Thí sinh nộp hồ sơ mô tả ý tưởng trên Cổng thông tin. Hội đồng chuyên môn đánh giá tính khả thi, sự sáng tạo và tiềm năng triển khai thực tiễn.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-orange)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                2
              </span>
              <div>
                <strong style={{ display: "block", color: "var(--foreground)", fontSize: "1rem" }}>Vòng 2: Hoàn thiện hồ sơ & Ghép đội (Hội chợ ý tưởng)</strong>
                <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  Các đề tài vượt qua sơ loại hoàn thiện danh sách thành viên nghiên cứu, mở tin tuyển thêm cộng sự tại Hội chợ ý tưởng và nhận cố vấn từ chuyên gia.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-orange)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                3
              </span>
              <div>
                <strong style={{ display: "block", color: "var(--foreground)", fontSize: "1rem" }}>Vòng Chung kết: Trình diễn sản phẩm & Trao giải</strong>
                <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  Các nhóm thuyết trình nguyên mẫu (prototype/demo), bảo vệ đề tài trước Hội đồng giám khảo doanh nghiệp và nhận vinh danh tại Sảnh giải thưởng.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Tiêu chí chấm điểm */}
        <section
          className="form-panel"
          style={{
            width: "100%",
            padding: "clamp(18px, 4vw, 32px)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(245, 158, 11, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f59e0b",
              }}
            >
              <Award size={22} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>5. Tiêu chí đánh giá định hướng</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <CheckCircle2 size={16} style={{ color: "var(--brand-orange)" }} />
                <strong>Tính mới & Sáng tạo</strong>
              </div>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
                Cách tiếp cận độc đáo, áp dụng công nghệ mới giải quyết triệt để vấn đề đặt ra.
              </p>
            </div>

            <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <CheckCircle2 size={16} style={{ color: "var(--brand-orange)" }} />
                <strong>Tính khả thi kỹ thuật</strong>
              </div>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
                Công nghệ áp dụng rõ ràng, lộ trình phát triển hợp lý và có khả năng xây dựng nguyên mẫu.
              </p>
            </div>

            <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <CheckCircle2 size={16} style={{ color: "var(--brand-orange)" }} />
                <strong>Tác động xã hội & Giá trị ứng dụng</strong>
              </div>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
                Hiệu quả kinh tế, đóng góp cho ngành giao thông, đô thị, xây dựng và cộng đồng.
              </p>
            </div>

            <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <CheckCircle2 size={16} style={{ color: "var(--brand-orange)" }} />
                <strong>Năng lực đội ngũ & Thuyết trình</strong>
              </div>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
                Sự phối hợp giữa các thành viên, khả năng phản biện và phân công vai trò khoa học.
              </p>
            </div>
          </div>
        </section>

        {/* Section 6: FAQ & Quyền lợi */}
        <section
          className="form-panel"
          style={{
            width: "100%",
            padding: "clamp(18px, 4vw, 32px)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(99, 102, 241, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6366f1",
              }}
            >
              <HelpCircle size={22} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>6. Câu hỏi thường gặp & Hỗ trợ</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <strong style={{ color: "var(--foreground)" }}>Tôi chưa có nhóm, có thể tham gia được không?</strong>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                Hoàn toàn được! Bạn có thể tự đăng ký ý tưởng với vai trò cá nhân, hoặc truy cập <strong>Hội chợ ý tưởng</strong> để tìm kiếm các đề tài phù hợp và ứng tuyển vào nhóm nghiên cứu.
              </p>
            </div>
            <div>
              <strong style={{ color: "var(--foreground)" }}>Hồ sơ dự thi có được bảo mật không?</strong>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                Toàn bộ dữ liệu hồ sơ và ý tưởng được bảo mật tuyệt đối theo quy trình mã hóa dữ liệu. Quyền tác giả và sở hữu trí tuệ của nhóm nghiên cứu được tôn trọng và bảo vệ.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* CTA Footer */}
      <div
        style={{
          marginTop: 48,
          textAlign: "center",
          padding: "36px 24px",
          background: "linear-gradient(135deg, rgba(242, 92, 5, 0.08) 0%, rgba(2, 132, 199, 0.08) 100%)",
          borderRadius: 20,
          border: "1px solid var(--border)",
        }}
      >
        <h3 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 10px 0" }}>
          Sẵn sàng đưa ý tưởng của bạn thành hiện thực?
        </h3>
        <p style={{ color: "var(--muted)", maxWidth: 560, margin: "0 auto 24px auto", lineHeight: 1.5 }}>
          Khởi đầu hành trình sáng tạo công nghệ cùng các bạn đồng hành ngay hôm nay.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <Button onClick={() => goToTab("gui-y-tuong")}>
            Gửi ý tưởng ngay <ArrowRight size={16} />
          </Button>
          <Button variant="outline" onClick={() => goToTab("hoi-cho-y-tuong")}>
            Khám phá Hội chợ ý tưởng
          </Button>
        </div>
      </div>
    </div>
  );
}
