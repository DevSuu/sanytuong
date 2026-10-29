"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailTypoSuggestion } from "@/components/ui/email-typo-suggestion";
import { lookupRequestSchema, LookupRequestInput } from "@/lib/validation/idea-schema";

export function LookupForm({ id = "lookup-email" }: { id?: string }) {
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LookupRequestInput>({
    resolver: zodResolver(lookupRequestSchema),
  });

  const watchedEmail = watch("email") || "";

  const onSubmit = async (data: LookupRequestInput) => {
    setServerMessage(null);
    try {
      const res = await fetch("/api/lookup/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      setServerMessage(
        result.message ||
          "Nếu email đã được đăng ký trong hệ thống, chúng tôi đã gửi đường dẫn tra cứu tới email của bạn.",
      );
      reset();
    } catch {
      setServerMessage("Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
    }
  };

  return (
    <form className="lookup-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="lookup-fields">
        <div className="input-icon">
          <Mail size={18} />
          <label htmlFor={id} className="sr-only">
            Email đã đăng ký
          </label>
          <input
            id={id}
            type="email"
            autoComplete="email"
            placeholder="Nhập email đã đăng ký của bạn"
            aria-describedby={`${id}-help`}
            disabled={isSubmitting}
            {...register("email")}
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Đang gửi...
            </>
          ) : (
            "Gửi lại link tra cứu"
          )}
        </Button>
      </div>

      <EmailTypoSuggestion
        email={watchedEmail}
        onAccept={(fixed) =>
          setValue("email", fixed, { shouldValidate: true, shouldDirty: true })
        }
      />

      {errors.email && (
        <p className="form-error" style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>
          {errors.email.message}
        </p>
      )}

      {serverMessage && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "rgba(22, 163, 74, 0.1)",
            border: "1px solid rgba(22, 163, 74, 0.3)",
            borderRadius: "6px",
            color: "#16a34a",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{serverMessage}</span>
        </div>
      )}

      <p id={`${id}-help`} className="form-help">
        Hệ thống bảo vệ danh tính: Danh sách ý tưởng không hiển thị trực tiếp bằng việc nhập email mà chỉ gửi qua đường dẫn bí mật về hòm thư của bạn.
      </p>
    </form>
  );
}
