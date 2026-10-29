"use client";
import { LookupForm } from "@/components/lookup-form";

export function LookupView() {
  return (
    <div className="container page-shell">
      <p className="eyebrow">KẾT NỐI VỚI Ý TƯỞNG CỦA BẠN</p>
      <h1>Tra cứu ý tưởng</h1>
      <p className="page-intro">
        Một email – một đường link cho tất cả ý tưởng.
      </p>
      <div className="notice">
        Khi được triển khai, hệ thống sẽ gửi lại link riêng vào email đã xác
        nhận. Danh sách hồ sơ không được hiển thị chỉ bằng việc nhập email.
      </div>
      <div className="form-panel">
        <LookupForm />
        <p
          className="page-intro"
          style={{ marginTop: 20, marginBottom: 0, fontSize: 12 }}
        >
          Link tra cứu được giữ nguyên khi bạn gửi thêm ý tưởng. Thao tác sửa và
          xem thông tin riêng tư sẽ cần xác thực bổ sung.
        </p>
      </div>
    </div>
  );
}
