"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, User, Loader2, AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let targetEmail = email.trim().toLowerCase();
      if (targetEmail === "admin@localhost") {
        targetEmail = "admin@localhost.local";
      } else if (!targetEmail.includes("@")) {
        targetEmail = `${targetEmail}@localhost.local`;
      }

      const result = await authClient.signIn.email({
        email: targetEmail,
        password,
      });

      if (result.error) {
        setErrorMessage(
          result.error.message || "Email/tài khoản hoặc mật khẩu không chính xác."
        );
        setIsLoading(false);
        return;
      }

      router.push("/quan-tri");
      router.refresh();
    } catch {
      setErrorMessage("Không thể kết nối đến máy chủ xác thực. Vui lòng thử lại.");
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {errorMessage && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderRadius: "var(--radius)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontSize: 13,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="admin-email"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          Tài khoản quản trị viên
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {" "}
            Email quản trị viên
          </span>
        </label>
        <div style={{ position: "relative" }}>
          <User
            size={16}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
            }}
          />
          <input
            id="admin-email"
            aria-label="Email quản trị viên"
            type="text"
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Nhập tài khoản quản trị"
            style={{
              width: "100%",
              height: 44,
              padding: "0 14px 0 42px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--input)",
              color: "var(--foreground)",
              fontSize: 14,
            }}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="admin-password"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          Mật khẩu
        </label>
        <div style={{ position: "relative" }}>
          <Lock
            size={16}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
            }}
          />
          <input
            id="admin-password"
            type="password"
            required
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
            style={{
              width: "100%",
              height: 44,
              padding: "0 14px 0 42px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--input)",
              color: "var(--foreground)",
              fontSize: 14,
            }}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading || !email.trim() || !password}
        style={{
          width: "100%",
          height: 44,
          background: "var(--brand-orange)",
          color: "#fff",
          fontWeight: 600,
          border: "none",
          borderRadius: "var(--radius)",
          cursor: isLoading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: 14,
          marginTop: 6,
        }}
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" size={18} />
            Đang đăng nhập...
          </>
        ) : (
          <>
            <ShieldCheck size={18} />
            Đăng nhập hệ thống
          </>
        )}
      </Button>
    </form>
  );
}
