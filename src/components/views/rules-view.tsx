"use client";

import React from "react";
import {
  BookOpen,
  Users,
  Target,
  Layers,
  Award,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  Calendar,
  MapPin,
  Banknote,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppNavigation } from "@/context/navigation-context";

const COMPETITION_FIELDS = [
  {
    title: "1. Công nghệ đường sắt hiện đại",
    desc: "Đường sắt tốc độ cao, đường sắt điện khí hóa và đường sắt đô thị.",
  },
  {
    title: "2. Giao thông & Hạ tầng thông minh",
    desc: "Công nghệ giao thông và hạ tầng tiên tiến, thông minh, BIM, Digital Twin.",
  },
  {
    title: "3. CNTT, Trí tuệ nhân tạo & Dữ liệu",
    desc: "Công nghệ thông tin, trí tuệ nhân tạo ứng dụng, khoa học dữ liệu, an toàn thông tin.",
  },
  {
    title: "4. Tự động hóa, Cơ điện tử & Robot",
    desc: "Hệ thống tự động hóa, cơ điện tử và kỹ thuật robot ứng dụng.",
  },
  {
    title: "5. Logistics & Chuỗi cung ứng",
    desc: "Giải pháp tối ưu hóa vận tải, kho vận và quản trị chuỗi cung ứng hiện đại.",
  },
  {
    title: "6. Công nghệ xanh & Môi trường",
    desc: "Công nghệ xanh, năng lượng tái tạo, bảo vệ môi trường và ứng phó biến đổi khí hậu.",
  },
  {
    title: "7. Kinh tế số & Quản trị doanh nghiệp",
    desc: "Kinh tế số, thương mại điện tử và đổi mới mô hình quản trị doanh nghiệp.",
  },
  {
    title: "8. Công nghệ giáo dục (EdTech)",
    desc: "Giải pháp công nghệ phục vụ giáo dục, học tập số và quản lý đào tạo.",
  },
  {
    title: "9. Khoa học xã hội, Luật & Đa ngành",
    desc: "Khoa học xã hội, nhân văn, luật – chính trị, ngôn ngữ có ứng dụng công nghệ và các lĩnh vực liên quan khác.",
  },
];

const FUNDING_TIERS = [
  { amount: "150.000.000 VNĐ", duration: "Thời gian thực hiện tối đa 12 tháng" },
  { amount: "100.000.000 VNĐ", duration: "Thời gian thực hiện tối đa 12 tháng" },
  { amount: "50.000.000 VNĐ", duration: "Thời gian thực hiện tối đa 9 tháng" },
  { amount: "20.000.000 VNĐ", duration: "Thời gian thực hiện tối đa 6 tháng" },
  { amount: "10.000.000 VNĐ", duration: "Thời gian thực hiện tối đa 6 tháng" },
];

const TIMELINE_MILESTONES = [
  {
    time: "02/11/2026",
    title: "Lễ phát động Cuộc thi",
    desc: "Công bố Kế hoạch, thành lập Ban Tổ chức (BTC), Ban Giám khảo (BGK) và tổ chức Lễ phát động Cuộc thi.",
    unit: "Ban Tổ chức",
    highlight: false,
  },
  {
    time: "30/11/2026",
    title: "Hết hạn nộp hồ sơ Vòng 1",
    desc: "Đóng cổng tiếp nhận bản thuyết minh ý tưởng/dự án Vòng 1 trên website Cuộc thi.",
    unit: "Ban Tổ chức",
    highlight: true,
  },
  {
    time: "06/12/2026",
    title: "Chấm sơ khảo Vòng 1",
    desc: "Tổ chức chấm thi và lựa chọn các đội đủ điều kiện vào Vòng 2: Thuyết trình và xét hỗ trợ kinh phí phát triển ý tưởng.",
    unit: "Ban Giám khảo",
    highlight: false,
  },
  {
    time: "15/12/2026",
    title: "Ngày triển lãm Poster & Chung kết Vòng 2",
    desc: "Chấm chung kết và trao giải Vòng 2; công bố danh sách các dự án vào Vòng 3 cùng mức kinh phí hỗ trợ phát triển sản phẩm.",
    unit: "Ban Tổ chức & BGK",
    highlight: true,
  },
  {
    time: "01/2027",
    title: "Triển khai Vòng 3 & Giải ngân đợt 1 (30%)",
    desc: "Phê duyệt kinh phí, giải ngân đợt 1; các đội triển khai xây dựng sản phẩm kết hợp chuỗi buổi workshop, cố vấn và kết nối kỹ thuật.",
    unit: "Ban Tổ chức & Các đội thi",
    highlight: false,
  },
  {
    time: "04 – 05/2027",
    title: "Ngày hội triển lãm sản phẩm giữa kỳ & Giải ngân đợt 2 (50%)",
    desc: "Trình bày kết quả giữa kỳ; BGK đánh giá tiến độ và tiếp tục giải ngân đợt 2 cho các dự án đạt yêu cầu.",
    unit: "Ban Tổ chức & BGK",
    highlight: false,
  },
  {
    time: "06 – 12/2027",
    title: "Nghiệm thu dự án & Thanh toán đợt cuối (20%)",
    desc: "Nghiệm thu sản phẩm thực tế theo thời hạn cam kết của từng dự án và thanh toán 20% kinh phí hỗ trợ còn lại.",
    unit: "Hội đồng nghiệm thu",
    highlight: false,
  },
];

const ROUND_2_PRIZES = [
  { rank: "Giải Nhất", prize: "1.000.000 VNĐ", color: "#f59e0b" },
  { rank: "Giải Nhì", prize: "800.000 VNĐ", color: "#38bdf8" },
  { rank: "Giải Ba", prize: "600.000 VNĐ", color: "#fb923c" },
  { rank: "Giải Tiềm năng", prize: "500.000 VNĐ", color: "#10b981" },
];

export function RulesView() {
  const { goToTab } = useAppNavigation();

  return (
    <div className="container page-shell" style={{ maxWidth: 980, margin: "0 auto", paddingBottom: 64 }}>
      {/* Header Section */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <p className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <BookOpen size={15} /> QUY CHẾ & THỂ LỆ CHÍNH THỨC • SỐ 9575/KH-ĐHCNGTVT
        </p>
        <h1 style={{ fontSize: "clamp(1.65rem, 5vw, 2.35rem)", fontWeight: 800, margin: "12px 0 12px 0", lineHeight: 1.25 }}>
          Thể Lệ Cuộc Thi “Thử Thách Sáng Tạo 4.0 – Mùa 2”
        </h1>
        <p style={{ margin: "0 auto 12px auto", fontSize: "1.02rem", fontWeight: 600, color: "var(--brand-orange)" }}>
          Chủ đề: “Đẩy mạnh đổi mới sáng tạo và nghiên cứu khoa học”
        </p>
        <p className="page-intro" style={{ maxWidth: 760, margin: "0 auto", fontSize: "1rem", color: "var(--muted)", lineHeight: 1.65 }}>
          Thông tin quy chế đối tượng, lĩnh vực dự thi, lộ trình 03 vòng thi, tiến độ tổ chức, cơ cấu giải thưởng và mức hỗ trợ kinh phí phát triển sản phẩm theo Kế hoạch của Trường Đại học Công nghệ Giao thông vận tải.
        </p>
      </div>

      {/* Rule Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Section 1: Mục đích & Yêu cầu */}
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
                flexShrink: 0,
              }}
            >
              <BookOpen size={22} />
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>1. Mục đích & Yêu cầu chung</h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, lineHeight: 1.7, color: "var(--muted)" }}>
            <p style={{ margin: 0 }}>
              Cuộc thi <strong style={{ color: "var(--foreground)" }}>“Thử thách Sáng tạo 4.0 – Mùa 2”</strong> được tổ chức thiết thực chào mừng tân sinh viên K77, kỷ niệm ngày Nhà giáo Việt Nam 20/11 và 65 năm Bác Hồ về thăm Trường (29/11/1961); qua đó khơi dậy tinh thần dám nghĩ, dám làm, tạo môi trường học thuật để viên chức, người lao động và người học hiện thực hóa các ý tưởng sáng tạo, phát triển thành đề tài nghiên cứu khoa học và dự án khởi nghiệp thực tiễn.
            </p>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                background: "var(--background)",
                border: "1px solid var(--border)",
              }}
            >
              <strong style={{ display: "block", color: "var(--foreground)", marginBottom: 6 }}>
                Yêu cầu đối với ý tưởng, sản phẩm dự thi:
              </strong>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.75 }}>
                <li>Đảm bảo tính mới, tính sáng tạo và có tiềm năng ứng dụng thực tiễn.</li>
                <li>
                  <strong style={{ color: "var(--foreground)" }}>Không vi phạm quyền sở hữu trí tuệ</strong> và các quy định hiện hành của pháp luật.
                </li>
                <li>Được đánh giá công bằng, minh bạch theo bộ tiêu chí rõ ràng với sự tham gia của các chuyên gia, nhà khoa học uy tín.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 2: Đối tượng & Quy định đăng ký */}
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
                flexShrink: 0,
              }}
            >
              <Users size={22} />
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>2. Đối tượng & Quy định đăng ký</h2>
          </div>

          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.85, color: "var(--muted)" }}>
            <li>
              <strong style={{ color: "var(--foreground)" }}>Đối tượng dự thi:</strong> Toàn thể{" "}
              <strong style={{ color: "var(--foreground)" }}>viên chức, người lao động và người học</strong> đang công tác và học tập tại Trường Đại học Công nghệ Giao thông vận tải.
            </li>
            <li>
              <strong style={{ color: "var(--foreground)" }}>Hình thức đăng ký:</strong> Thí sinh đăng ký theo hình thức{" "}
              <strong style={{ color: "var(--foreground)" }}>cá nhân</strong> hoặc{" "}
              <strong style={{ color: "var(--foreground)" }}>theo nhóm (tối đa 10 thành viên/nhóm)</strong>.
            </li>
            <li>
              <strong style={{ color: "var(--foreground)" }}>Kết hợp liên ngành & thầy trò:</strong> Khuyến khích các nhóm có sự kết hợp giữa{" "}
              <strong style={{ color: "var(--foreground)" }}>giảng viên và sinh viên</strong>.
            </li>
            <li>
              <strong style={{ color: "var(--foreground)" }}>Số lượng ý tưởng dự thi:</strong>
              <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                <li>Mỗi cá nhân có thể đăng ký tham gia <strong style={{ color: "var(--foreground)" }}>01 hoặc nhiều ý tưởng</strong>.</li>
                <li>Mỗi nhóm có thể đăng ký <strong style={{ color: "var(--foreground)" }}>không giới hạn số lượng ý tưởng</strong>.</li>
              </ul>
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
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
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
                flexShrink: 0,
              }}
            >
              <Target size={22} />
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>3. Lĩnh vực dự thi</h2>
          </div>

          <p style={{ margin: "0 0 16px 0", color: "var(--muted)", lineHeight: 1.65 }}>
            Cuộc thi khuyến khích các ý tưởng, giải pháp sáng tạo thuộc <strong style={{ color: "var(--foreground)" }}>tất cả các lĩnh vực</strong>, tập trung vào các lĩnh vực mũi nhọn của Nhà trường và xu hướng của Cách mạng Công nghiệp 4.0 (bao gồm nhưng không giới hạn):
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
              gap: 14,
            }}
          >
            {COMPETITION_FIELDS.map((item) => (
              <div
                key={item.title}
                style={{
                  padding: "15px 16px",
                  borderRadius: 12,
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                }}
              >
                <strong style={{ display: "block", color: "var(--foreground)", marginBottom: 6, fontSize: "0.96rem" }}>
                  {item.title}
                </strong>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.55 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Quy trình 03 vòng thi & Hỗ trợ kinh phí */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
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
                flexShrink: 0,
              }}
            >
              <Layers size={22} />
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>
              4. Quy trình 03 Vòng thi & Hỗ trợ kinh phí phát triển
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Vòng 1 */}
            <div
              style={{
                padding: "clamp(16px, 3vw, 22px)",
                borderRadius: 14,
                background: "var(--background)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "var(--brand-orange)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  VÒNG 1
                </span>
                <strong style={{ fontSize: "1.08rem", color: "var(--foreground)" }}>Ý tưởng</strong>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.75, color: "var(--muted)", fontSize: "0.93rem" }}>
                <li>
                  <strong style={{ color: "var(--foreground)" }}>Nội dung & Sản phẩm:</strong> Các đội thi nộp{" "}
                  <strong style={{ color: "var(--foreground)" }}>Bản thuyết minh ý tưởng/dự án</strong> trên website của Cuộc thi, trình bày tính mới, tính sáng tạo, khả năng ứng dụng thực tiễn và kết quả dự kiến.
                </li>
                <li>
                  <strong style={{ color: "var(--foreground)" }}>Mức hỗ trợ Vòng 1:</strong> Các ý tưởng, đề xuất đạt yêu cầu được hỗ trợ{" "}
                  <strong style={{ color: "var(--brand-orange)" }}>100.000 VNĐ/ý tưởng</strong>.
                </li>
                <li>
                  <strong style={{ color: "var(--foreground)" }}>Kết quả:</strong> Ban Giám khảo (BGK) đánh giá hồ sơ theo tiêu chí và lựa chọn các ý tưởng khả thi đủ điều kiện bước vào Vòng 2.
                </li>
              </ul>
            </div>

            {/* Vòng 2 */}
            <div
              style={{
                padding: "clamp(16px, 3vw, 22px)",
                borderRadius: 14,
                background: "var(--background)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "#0284c7",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  VÒNG 2
                </span>
                <strong style={{ fontSize: "1.08rem", color: "var(--foreground)" }}>
                  Thuyết trình & Xét hỗ trợ kinh phí phát triển ý tưởng
                </strong>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.75, color: "var(--muted)", fontSize: "0.93rem" }}>
                <li>
                  <strong style={{ color: "var(--foreground)" }}>Sản phẩm chuẩn bị:</strong> Poster thuyết trình, bản thuyết minh sản phẩm dự kiến, kế hoạch triển khai và dự toán kinh phí.
                </li>
                <li>
                  <strong style={{ color: "var(--foreground)" }}>Hình thức dự thi:</strong> Đội thi trình bày nguyên lý hoạt động, tính khả thi và minh chứng kỹ thuật; khuyến khích có bản mẫu (prototype) hoặc demo nếu đã có để được xem xét đề xuất hỗ trợ kinh phí.
                </li>
                <li>
                  <strong style={{ color: "var(--foreground)" }}>Kết quả:</strong> BGK đánh giá hồ sơ, poster và phần thuyết trình để{" "}
                  <strong style={{ color: "var(--foreground)" }}>xét giải thưởng Vòng 2</strong>, đồng thời đề xuất danh sách dự án và mức kinh phí hỗ trợ trình Nhà trường phê duyệt.
                </li>
              </ul>
            </div>

            {/* Vòng 3 */}
            <div
              style={{
                padding: "clamp(16px, 3vw, 22px)",
                borderRadius: 14,
                background: "var(--background)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "#10b981",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  VÒNG 3
                </span>
                <strong style={{ fontSize: "1.08rem", color: "var(--foreground)" }}>
                  Phát triển sản phẩm (Thời gian thực hiện 06 – 12 tháng)
                </strong>
              </div>

              <ul style={{ margin: "0 0 16px 0", paddingLeft: 20, lineHeight: 1.75, color: "var(--muted)", fontSize: "0.93rem" }}>
                <li>
                  <strong style={{ color: "var(--foreground)" }}>Sản phẩm theo giai đoạn:</strong> Báo cáo tiến độ, minh chứng các nhiệm vụ đã thực hiện, kết quả sản phẩm (bản mẫu, mô hình, phần mềm, thử nghiệm hoặc kết quả tương đương tùy đặc thù dự án) và kế hoạch sử dụng kinh phí cho giai đoạn tiếp theo.
                </li>
                <li>
                  <strong style={{ color: "var(--foreground)" }}>Cơ chế ươm tạo & Kết nối:</strong> Các dự án phù hợp được xem xét đăng ký, xét duyệt thành{" "}
                  <strong style={{ color: "var(--foreground)" }}>đề tài/dự án KH&CN cấp Trường</strong> theo quy định; Nhà trường hỗ trợ kết nối chuyên gia cố vấn và tìm kiếm các quỹ đầu tư để phát triển thành dự án khởi nghiệp hoặc ứng dụng thực tiễn.
                </li>
              </ul>

              {/* 5 Funding Tiers */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Banknote size={18} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
                  <strong style={{ color: "var(--foreground)", fontSize: "0.95rem" }}>
                    05 mức kinh phí hỗ trợ phát triển sản phẩm (do Nhà trường phê duyệt):
                  </strong>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
                    gap: 10,
                  }}
                >
                  {FUNDING_TIERS.map((tier) => (
                    <div
                      key={tier.amount}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <strong style={{ display: "block", color: "var(--brand-orange)", fontSize: "0.98rem" }}>
                        {tier.amount}
                      </strong>
                      <span style={{ fontSize: "0.83rem", color: "var(--muted)" }}>{tier.duration}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3-Stage Disbursement */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <strong style={{ display: "block", color: "var(--foreground)", fontSize: "0.95rem", marginBottom: 8 }}>
                  Lộ trình giải ngân & Kiểm tra tiến độ 03 đợt:
                </strong>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.9rem", color: "var(--muted)", lineHeight: 1.65 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <CheckCircle2 size={16} style={{ color: "#10b981", flexShrink: 0, marginTop: 4 }} />
                    <span>
                      <strong style={{ color: "var(--foreground)" }}>Đợt 1 (30% tổng kinh phí phê duyệt):</strong> Cấp ngay khi dự án được phê duyệt để triển khai xây dựng sản phẩm giai đoạn đầu.
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <CheckCircle2 size={16} style={{ color: "#10b981", flexShrink: 0, marginTop: 4 }} />
                    <span>
                      <strong style={{ color: "var(--foreground)" }}>Đợt 2 (50% tổng kinh phí phê duyệt):</strong> Cấp cho dự án đạt tiến độ sau khi BGK kiểm tra tại{" "}
                      <strong style={{ color: "var(--foreground)" }}>“Ngày hội triển lãm sản phẩm giữa kỳ”</strong> (đánh giá mức độ hoàn thành mốc cam kết, tính khả thi kỹ thuật, chất lượng kết quả hiện có và việc sử dụng kinh phí).
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <CheckCircle2 size={16} style={{ color: "#10b981", flexShrink: 0, marginTop: 4 }} />
                    <span>
                      <strong style={{ color: "var(--foreground)" }}>Đợt 3 (20% tổng kinh phí phê duyệt):</strong> Thanh toán khi kết thúc dự án và nghiệm thu sản phẩm thực tế đạt yêu cầu theo cam kết. Dự án không đạt yêu cầu phải có phương án khắc phục, xử lý kinh phí theo quy định.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Tiến độ triển khai */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
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
                flexShrink: 0,
              }}
            >
              <Calendar size={22} />
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>5. Tiến độ triển khai Cuộc thi</h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {TIMELINE_MILESTONES.map((step) => (
              <div
                key={step.time + step.title}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: step.highlight ? "rgba(242, 92, 5, 0.06)" : "var(--background)",
                  border: step.highlight ? "1px solid rgba(242, 92, 5, 0.35)" : "1px solid var(--border)",
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        background: step.highlight ? "var(--brand-orange)" : "rgba(148, 163, 184, 0.16)",
                        color: step.highlight ? "#fff" : "var(--foreground)",
                      }}
                    >
                      {step.time}
                    </span>
                    <strong style={{ color: "var(--foreground)", fontSize: "0.98rem" }}>{step.title}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", lineHeight: 1.6 }}>{step.desc}</p>
                </div>
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--muted)",
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {step.unit}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 6: Cơ cấu giải thưởng Vòng 2 */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
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
                flexShrink: 0,
              }}
            >
              <Award size={22} />
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>6. Cơ cấu Giải thưởng (Vòng 2)</h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
              gap: 14,
              marginBottom: 16,
            }}
          >
            {ROUND_2_PRIZES.map((item) => (
              <div
                key={item.rank}
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  borderTop: `3px solid ${item.color}`,
                }}
              >
                <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                  {item.rank}
                </span>
                <strong style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--foreground)" }}>{item.prize}</strong>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.28)",
              fontSize: "0.92rem",
              lineHeight: 1.65,
              color: "var(--foreground)",
            }}
          >
            <strong>Quyền lợi & Hỗ trợ khác:</strong> Các dự án đạt giải được cấp đề tài cấp Trường có kinh phí hoặc thực hiện dự án theo quy định của Nhà trường.{" "}
            <strong style={{ color: "var(--brand-orange)" }}>
              Giải thưởng Vòng 2 và kinh phí hỗ trợ phát triển dự án (Vòng 3) là hai khoản độc lập.
            </strong>
          </div>
        </section>

        {/* Section 7: Thông tin liên hệ & Câu hỏi thường gặp */}
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
                flexShrink: 0,
              }}
            >
              <HelpCircle size={22} />
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>7. Thông tin liên hệ & Hỗ trợ Cuộc thi</h2>
          </div>

          <div
            style={{
              padding: "16px",
              borderRadius: 12,
              background: "var(--background)",
              border: "1px solid var(--border)",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: "0.93rem",
              lineHeight: 1.65,
              color: "var(--muted)",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Users size={18} style={{ color: "var(--brand-orange)", flexShrink: 0, marginTop: 3 }} />
              <span>
                <strong style={{ color: "var(--foreground)" }}>Đơn vị thường trực hỗ trợ:</strong> Trung tâm Công nghệ BIM&AI – Viện Công nghệ Đường sắt & GTVT (phối hợp cùng Nhóm nghiên cứu Ứng dụng Công nghệ 4.0 trong GTVT – I4T), Trường Đại học Công nghệ Giao thông vận tải.
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <MapPin size={18} style={{ color: "var(--brand-orange)", flexShrink: 0, marginTop: 3 }} />
              <span>
                <strong style={{ color: "var(--foreground)" }}>Địa chỉ:</strong> Số 54 Triều Khúc – Thanh Liệt – Hà Nội.
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Globe size={18} style={{ color: "var(--brand-orange)", flexShrink: 0, marginTop: 3 }} />
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <strong style={{ color: "var(--foreground)" }}>Website chính thức:</strong> https://sanytuong.utt.edu.vn
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <strong style={{ color: "var(--foreground)" }}>Chưa đủ thành viên hoặc muốn tìm cộng sự liên ngành thì làm thế nào?</strong>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                Bạn có thể đăng ký dự thi cá nhân, hoặc sử dụng tính năng <strong>Hội chợ ý tưởng</strong> trên cổng thông tin để đăng tin tìm cộng sự và ứng tuyển vào các nhóm nghiên cứu phù hợp (tối đa 10 thành viên/nhóm).
              </p>
            </div>
            <div>
              <strong style={{ color: "var(--foreground)" }}>Làm sao để theo dõi và cập nhật hồ sơ sau khi nộp?</strong>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                Hệ thống gửi liên kết tra cứu bảo mật trực tiếp qua email đăng ký của Trưởng nhóm / Tác giả, đảm bảo an toàn thông tin và bảo vệ quyền tác giả đối với thuyết minh ý tưởng.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* CTA Footer */}
      <div
        style={{
          marginTop: 44,
          textAlign: "center",
          padding: "clamp(24px, 5vw, 36px) clamp(16px, 4vw, 24px)",
          background: "linear-gradient(135deg, rgba(242, 92, 5, 0.08) 0%, rgba(2, 132, 199, 0.08) 100%)",
          borderRadius: 20,
          border: "1px solid var(--border)",
        }}
      >
        <h3 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 10px 0" }}>
          Sẵn sàng hiện thực hóa ý tưởng tại Mùa 2?
        </h3>
        <p style={{ color: "var(--muted)", maxWidth: 580, margin: "0 auto 22px auto", lineHeight: 1.55 }}>
          Hạn cuối nộp hồ sơ Vòng 1 đến hết ngày <strong style={{ color: "var(--foreground)" }}>30/11/2026</strong>. Đăng ký ý tưởng ngay hôm nay hoặc kết nối đội nhóm tại Hội chợ ý tưởng.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
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
