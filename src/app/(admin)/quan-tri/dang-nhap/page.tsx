import React from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { AdminLoginForm } from "@/components/admin-login-form";

export const metadata = {
  title: "Đăng nhập Quản trị — Thử thách sáng tạo 4.0 UTT",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // If already authenticated as ADMIN, redirect straight to dashboard
  const session = await getAdminSession();
  if (session) {
    redirect("/quan-tri");
  }

  return (
    <div
      className="container"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 200px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "calc(var(--radius) * 1.5)",
          padding: "36px 32px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.06)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "50%",
              backgroundColor: "rgba(242, 92, 5, 0.1)",
              color: "var(--brand-orange)",
              marginBottom: 16,
            }}
          >
            <ShieldCheck size={30} />
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--foreground)",
              marginBottom: 8,
            }}
          >
            Cổng Quản trị Viên
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            Dành cho Ban tổ chức Cuộc thi Sáng tạo UTT 4.0. Quyền hạn bảo mật cấp Ban chỉ đạo.
          </p>
        </div>

        <AdminLoginForm />
      </div>
    </div>
  );
}
