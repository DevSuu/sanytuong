import { Metadata } from "next";
import { SpaShell } from "@/components/spa-shell";

export const metadata: Metadata = {
  title: "Hội chợ ý tưởng – Cuộc thi Thử thách Sáng tạo 4.0 UTT",
  description: "Không gian kết nối giữa các nhóm tác giả đề tài sáng tạo và sinh viên tìm kiếm cơ hội gia nhập nhóm nghiên cứu.",
};

export default function IdeaFairPage() {
  return <SpaShell />;
}
