"use client";

import React from "react";
import { MapPin, Users, Globe, BookOpen, Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppNavigation } from "@/context/navigation-context";

export function ContactView() {
  const { goToTab } = useAppNavigation();

  return (
    <div className="container page-shell" style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 64 }}>
      <p className="eyebrow">HỖ TRỢ THÍ SINH & ĐỘI THI</p>
      <h1 style={{ fontSize: "clamp(1.7rem, 5vw, 2.3rem)", fontWeight: 800, margin: "10px 0 14px 0" }}>
        Liên hệ & Hỗ trợ Cuộc thi
      </h1>
      <p className="page-intro" style={{ color: "var(--muted)", lineHeight: 1.65, marginBottom: 28 }}>
        Thông tin đầu mối hỗ trợ chính thức của Cuộc thi “Thử thách Sáng tạo 4.0 – Mùa 2” theo Kế hoạch số 9575/KH-ĐHCNGTVT của Trường Đại học Công nghệ Giao thông vận tải.
      </p>

      <div
        className="form-panel"
        style={{
          padding: "clamp(18px, 4vw, 30px)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
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
            <Users size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: "1rem", color: "var(--foreground)", marginBottom: 4 }}>
              Đơn vị thường trực hỗ trợ
            </strong>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.65 }}>
              Trung tâm Công nghệ BIM&AI – Viện Công nghệ Đường sắt & GTVT (cùng Nhóm nghiên cứu Ứng dụng Công nghệ 4.0 trong Giao thông vận tải – I4T), Trường Đại học Công nghệ Giao thông vận tải.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
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
            <MapPin size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: "1rem", color: "var(--foreground)", marginBottom: 4 }}>
              Địa chỉ liên hệ trực tiếp
            </strong>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.65 }}>
              Số 54 Triều Khúc – Thanh Liệt – Hà Nội.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
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
            <Globe size={20} />
          </div>
          <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            <strong style={{ display: "block", fontSize: "1rem", color: "var(--foreground)", marginBottom: 4 }}>
              Cổng thông tin trực tuyến
            </strong>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.65 }}>
              <strong>https://sanytuong.utt.edu.vn</strong> — Tra cứu thể lệ, đăng ký ý tưởng, kết nối thành viên và theo dõi thông báo, kết quả chính thức của Cuộc thi.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Button onClick={() => goToTab("gui-y-tuong")}>
          Gửi ý tưởng dự thi <ArrowRight size={16} />
        </Button>
        <Button variant="outline" onClick={() => goToTab("the-le")}>
          <BookOpen size={16} /> Xem Thể lệ chi tiết
        </Button>
        <Button variant="outline" onClick={() => goToTab("tra-cuu")}>
          <Search size={16} /> Nhận lại link tra cứu
        </Button>
      </div>
    </div>
  );
}
