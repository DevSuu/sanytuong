import { EmailJobType } from "@/generated/prisma/client";

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function baseHtmlLayout(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 24px; line-height: 1.6; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #cbd5e1; }
    .body { padding: 32px 24px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #111827; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .info-label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; }
    .info-value { font-size: 16px; color: #ea580c; font-weight: 700; margin-top: 4px; }
    .reason-box { background: #fff7ed; border-left: 4px solid #ea580c; padding: 14px 16px; border-radius: 4px; margin: 16px 0; font-style: italic; color: #9a3412; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #ea580c; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; }
    .footer a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>TRƯỜNG ĐẠI HỌC CÔNG NGHỆ GIAO THÔNG VẬN TẢI</h1>
      <p>Cuộc thi Thử thách sáng tạo 4.0 — UTT Innovation Contest</p>
    </div>
    <div class="body">
      ${contentHtml}
    </div>
    <div class="footer">
      <p>Email này được gửi tự động từ hệ thống Cổng thông tin Cuộc thi Sáng tạo UTT.</p>
      <p>Ban tổ chức: Trung tâm Công nghệ BIM & AI — Email hỗ trợ: <a href="mailto:i4t@utt.edu.vn">i4t@utt.edu.vn</a></p>
    </div>
  </div>
</body>
</html>`;
}

export function renderEmail(
  type: EmailJobType,
  payload: Record<string, unknown>,
): RenderedEmail {
  switch (type) {
    case EmailJobType.VERIFY_EMAIL: {
      const submitterName = String(payload.submitterName || "Thí sinh");
      const refCode = String(payload.referenceCode || "N/A");
      const ideaTitle = String(payload.ideaTitle || "Ý tưởng dự thi");
      const verificationUrl = String(payload.verificationUrl || "");

      const subject = `[UTT - Sáng tạo 4.0] Xác thực email đăng ký ý tưởng: ${refCode}`;

      const text = `Kính gửi ${submitterName},

Cảm ơn bạn đã gửi ý tưởng tham gia Cuộc thi "Thử thách sáng tạo 4.0" của Trường Đại học Công nghệ GTVT.

Thông tin hồ sơ:
- Mã hồ sơ: ${refCode}
- Tên ý tưởng: ${ideaTitle}

Để ý tưởng của bạn chính thức được đưa vào danh sách xét duyệt của Ban tổ chức, vui lòng truy cập đường dẫn sau để xác thực quyền sở hữu email:
${verificationUrl}

(Đường dẫn xác thực có hiệu lực trong vòng 24 giờ).

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo 4.0 UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${submitterName},</div>
        <p>Cảm ơn bạn đã nộp hồ sơ tham gia cuộc thi <strong>"Thử thách sáng tạo 4.0"</strong> tại Trường Đại học Công nghệ Giao thông vận tải.</p>
        
        <div class="info-box">
          <div class="info-label">Mã hồ sơ ý tưởng</div>
          <div class="info-value">${refCode}</div>
          <p style="margin: 8px 0 0; font-size: 14px; color: #334155;"><strong>Tên ý tưởng:</strong> ${ideaTitle}</p>
        </div>

        <p>Để hoàn tất thủ tục và đưa ý tưởng vào quy trình xét duyệt chính thức của Ban giám khảo, vui lòng nhấn vào nút xác nhận bên dưới:</p>

        <div class="btn-container">
          <a href="${verificationUrl}" class="btn" target="_blank">Xác thực địa chỉ email ngay</a>
        </div>

        <p style="font-size: 13px; color: #64748b;"><em>* Liên kết này có thời hạn sử dụng trong 24 giờ. Nếu bạn không thực hiện đăng ký ý tưởng này, vui lòng bỏ qua email.</em></p>
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.LOOKUP_LINK: {
      const submitterName = String(payload.submitterName || "Thí sinh");
      const lookupUrl = String(payload.lookupUrl || "");
      const refCode = payload.referenceCode ? String(payload.referenceCode) : null;

      const subject = `[UTT - Sáng tạo 4.0] Liên kết tra cứu hồ sơ ý tưởng`;

      const text = `Kính gửi ${submitterName},

Chúng tôi gửi lại bạn liên kết tra cứu hồ sơ ý tưởng cá nhân tại Cuộc thi "Thử thách sáng tạo 4.0" — UTT.

Đường dẫn tra cứu vĩnh viễn của bạn:
${lookupUrl}

${refCode ? `Hồ sơ vừa cập nhật: ${refCode}\n` : ""}
Bạn có thể sử dụng liên kết trên bất cứ lúc nào để theo dõi tiến độ xét duyệt và kết quả của các ý tưởng đã nộp.

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo 4.0 UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${submitterName},</div>
        <p>Theo yêu cầu của bạn, hệ thống gửi liên kết tra cứu hồ sơ trực tuyến dành riêng cho địa chỉ email của bạn tại Cuộc thi <strong>"Thử thách sáng tạo 4.0"</strong>.</p>
        
        ${
          refCode
            ? `
        <div class="info-box">
          <div class="info-label">Hồ sơ gần nhất</div>
          <div class="info-value">${refCode}</div>
        </div>
        `
            : ""
        }

        <p>Liên kết tra cứu này là <strong>duy nhất và vĩnh viễn</strong> cho email của bạn. Mọi ý tưởng bạn đã đăng ký đều được tổng hợp đầy đủ tại trang này:</p>

        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" target="_blank">Truy cập Trang tra cứu hồ sơ</a>
        </div>

        <p style="font-size: 13px; color: #64748b;"><em>* Vui lòng lưu lại email này để tiện theo dõi tiến độ đánh giá từ Hội đồng giám khảo.</em></p>
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.IDEA_APPROVED: {
      const submitterName = String(payload.submitterName || "Thí sinh");
      const refCode = String(payload.referenceCode || "N/A");
      const title = String(payload.title || "Ý tưởng dự thi");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : null;

      const subject = `[UTT - Sáng tạo 4.0] Chúc mừng! Ý tưởng "${refCode}" đã được phê duyệt`;

      const text = `Kính gửi ${submitterName},

Ban tổ chức Cuộc thi "Thử thách sáng tạo 4.0" trân trọng thông báo:
Ý tưởng của bạn "${title}" (Mã hồ sơ: ${refCode}) ĐÃ ĐƯỢC PHÊ DUYỆT!

Hồ sơ của bạn đã vượt qua vòng sơ loại và đủ điều kiện bước tiếp vào các vòng đánh giá chuyên sâu / ghép đội giải quyết nhiệm vụ thực tế.

Ban tổ chức sẽ liên hệ và gửi hướng dẫn chi tiết các bước tiếp theo trong thời gian sớm nhất.
${lookupUrl ? `\nBạn có thể theo dõi tiến độ và thông tin hồ sơ tại:\n${lookupUrl}\n` : ""}
Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo 4.0 UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${submitterName},</div>
        <p style="color: #16a34a; font-weight: 600; font-size: 17px;">🎉 CHÚC MỪNG BẠN VÀ NHÓM TÁC GIẢ!</p>
        <p>Ban tổ chức cuộc thi <strong>"Thử thách sáng tạo 4.0"</strong> trân trọng thông báo ý tưởng của bạn đã được Hội đồng chuyên môn <strong>PHÊ DUYỆT</strong>.</p>
        
        <div class="info-box" style="border-left: 4px solid #16a34a;">
          <div class="info-label">Mã hồ sơ được phê duyệt</div>
          <div class="info-value" style="color: #16a34a;">${refCode}</div>
          <p style="margin: 8px 0 0; font-size: 14px; color: #334155;"><strong>Tên ý tưởng:</strong> ${title}</p>
        </div>

        <p>Hồ sơ của bạn đã đủ điều kiện tiến vào các vòng cố vấn chuyên sâu và tham gia giải quyết các bài toán thực tiễn của doanh nghiệp.</p>
        <p>Ban tổ chức sẽ tiếp tục gửi thông báo về lịch trình và hướng dẫn chi tiết qua email này.</p>
        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" target="_blank">Tra cứu tiến độ hồ sơ</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.IDEA_REJECTED: {
      const submitterName = String(payload.submitterName || "Thí sinh");
      const refCode = String(payload.referenceCode || "N/A");
      const title = String(payload.title || "Ý tưởng dự thi");
      const reason = String(payload.reason || "Hồ sơ chưa phù hợp với tiêu chí cuộc thi đợt này.");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : null;

      const subject = `[UTT - Sáng tạo 4.0] Thông báo kết quả xét duyệt ý tưởng "${refCode}"`;

      const text = `Kính gửi ${submitterName},

Cảm ơn bạn đã quan tâm và gửi ý tưởng "${title}" (Mã hồ sơ: ${refCode}) tham gia Cuộc thi "Thử thách sáng tạo 4.0".

Sau khi xem xét kỹ lưỡng, Hội đồng đánh giá rất tiếc phải thông báo ý tưởng chưa thể tiếp tục đi tiếp trong đợt xét duyệt này.

Lý do từ Ban giám khảo:
${reason}

Ban tổ chức trân trọng tinh thần đổi mới sáng tạo của bạn và hy vọng tiếp tục nhận được các giải pháp sáng tạo khác của bạn trong các đợt phát động tiếp theo!
${lookupUrl ? `\nBạn có thể tra cứu lại danh sách hồ sơ của mình tại:\n${lookupUrl}\n` : ""}
Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo 4.0 UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${submitterName},</div>
        <p>Cảm ơn bạn đã nhiệt tình đóng góp ý tưởng tham gia Cuộc thi <strong>"Thử thách sáng tạo 4.0"</strong> tại Trường Đại học Công nghệ GTVT.</p>
        
        <div class="info-box">
          <div class="info-label">Mã hồ sơ</div>
          <div class="info-value" style="color: #64748b;">${refCode}</div>
          <p style="margin: 8px 0 0; font-size: 14px; color: #334155;"><strong>Tên ý tưởng:</strong> ${title}</p>
        </div>

        <p>Sau khi tổng hợp ý kiến từ Hội đồng chuyên môn, Ban tổ chức rất tiếc thông báo ý tưởng chưa phù hợp để đi tiếp vào các vòng sau.</p>

        <div class="reason-box">
          <strong>Nhận xét từ Hội đồng thẩm định:</strong><br/>
          ${reason}
        </div>

        <p>Ban tổ chức đánh giá cao tinh thần sáng tạo của bạn và mong bạn tiếp tục phát triển ý tưởng để tham gia vào các cơ hội tiếp theo!</p>
        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" target="_blank">Xem hồ sơ ý tưởng</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.IDEA_REVISION_REQUESTED: {
      const submitterName = String(payload.submitterName || "Thí sinh");
      const refCode = String(payload.referenceCode || "N/A");
      const title = String(payload.title || "Ý tưởng dự thi");
      const reason = String(payload.reason || "Cần bổ sung thêm thông tin chi tiết.");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : null;

      const subject = `[UTT - Sáng tạo 4.0] Yêu cầu bổ sung / chỉnh sửa hồ sơ "${refCode}"`;

      const text = `Kính gửi ${submitterName},

Hội đồng chuyên môn đã xem xét ý tưởng "${title}" (Mã hồ sơ: ${refCode}) và nhận thấy ý tưởng có tiềm năng tốt, tuy nhiên cần bạn bổ sung hoặc làm rõ một số nội dung sau:

Nội dung yêu cầu chỉnh sửa / bổ sung:
${reason}

Vui lòng chuẩn bị các thông tin trên và liên hệ với Ban tổ chức qua email i4t@utt.edu.vn hoặc theo hướng dẫn để cập nhật hồ sơ.
${lookupUrl ? `\nBạn có thể xem lại chi tiết hồ sơ hiện tại tại:\n${lookupUrl}\n` : ""}
Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo 4.0 UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${submitterName},</div>
        <p>Hội đồng chuyên môn Cuộc thi <strong>"Thử thách sáng tạo 4.0"</strong> đã thẩm định hồ sơ ý tưởng của bạn.</p>
        
        <div class="info-box" style="border-left: 4px solid #ea580c;">
          <div class="info-label">Mã hồ sơ</div>
          <div class="info-value">${refCode}</div>
          <p style="margin: 8px 0 0; font-size: 14px; color: #334155;"><strong>Tên ý tưởng:</strong> ${title}</p>
        </div>

        <p>Ý tưởng của bạn được đánh giá cao về tính khả thi, tuy nhiên để đạt chuẩn xét duyệt bước tiếp theo, Ban tổ chức cần bạn bổ sung một số điểm:</p>

        <div class="reason-box">
          <strong>Yêu cầu chỉnh sửa / bổ sung từ Ban giám khảo:</strong><br/>
          ${reason}
        </div>

        <p>Vui lòng gửi phản hồi hoặc liên hệ lại với Ban tổ chức qua hòm thư <a href="mailto:i4t@utt.edu.vn">i4t@utt.edu.vn</a> để được hướng dẫn cập nhật hồ sơ.</p>
        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" target="_blank">Xem chi tiết hồ sơ</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.EDIT_REQUEST_REJECTED: {
      const leaderName = String(payload.leaderName || payload.submitterName || "Trưởng nhóm");
      const title = String(payload.title || payload.ideaTitle || "Đề tài");
      const refCode = String(payload.referenceCode || "");
      const reason = String(payload.reason || "Yêu cầu chỉnh sửa chưa đáp ứng quy chế cuộc thi.");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : "";

      const subject = `[UTT - Sáng tạo 4.0] Thông báo từ chối yêu cầu chỉnh sửa hồ sơ đề tài "${title}"`;
      const text = `Kính gửi ${leaderName},

Ban tổ chức Cuộc thi Thử thách Sáng tạo 4.0 UTT đã xem xét yêu cầu chỉnh sửa hồ sơ đề tài "${title}" (${refCode}).

Rất tiếc, yêu cầu xin chỉnh sửa của bạn chưa được phê duyệt với lý do sau:
"${reason}"

Bạn có thể theo dõi chi tiết trạng thái hồ sơ tại liên kết tra cứu cố định:
${lookupUrl}

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p>Ban tổ chức Cuộc thi Thử thách Sáng tạo 4.0 UTT đã xem xét yêu cầu chỉnh sửa hồ sơ đề tài của bạn:</p>

        <div class="info-box">
          <div class="info-label">Mã đề tài & Tên đề tài</div>
          <div class="info-value">${refCode ? `[${refCode}] ` : ""}${title}</div>
        </div>

        <div class="reason-box" style="border-left-color: #dc2626; background-color: #fef2f2; color: #991b1b;">
          <strong>Lý do từ chối yêu cầu chỉnh sửa:</strong><br/>
          ${reason}
        </div>

        <p>Hồ sơ đề tài của bạn hiện vẫn giữ nguyên trạng thái hoàn tất trước đó. Nếu cần trao đổi thêm, vui lòng liên hệ Ban tổ chức qua email <a href="mailto:i4t@utt.edu.vn">i4t@utt.edu.vn</a>.</p>

        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" target="_blank">Xem chi tiết trên Trang Tra cứu</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.EDIT_REQUEST_APPROVED: {
      const leaderName = String(payload.leaderName || payload.submitterName || "Trưởng nhóm");
      const title = String(payload.title || payload.ideaTitle || "Đề tài");
      const refCode = String(payload.referenceCode || "");
      const allowedFields = Array.isArray(payload.allowedFields)
        ? payload.allowedFields.join(", ")
        : String(payload.allowedFields || "Các trường đã yêu cầu");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : "";

      const subject = `[UTT - Sáng tạo 4.0] Chấp thuận yêu cầu chỉnh sửa hồ sơ đề tài "${title}"`;
      const text = `Kính gửi ${leaderName},

Yêu cầu xin chỉnh sửa hồ sơ đề tài "${title}" (${refCode}) của bạn đã được Ban tổ chức phê duyệt.

Các trường thông tin được phép chỉnh sửa:
${allowedFields}

Vui lòng truy cập trang tra cứu để cập nhật thông tin và gửi lại hồ sơ:
${lookupUrl}

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p>Ban tổ chức thông báo yêu cầu xin chỉnh sửa hồ sơ đề tài của bạn đã được phê duyệt:</p>

        <div class="info-box">
          <div class="info-label">Đề tài</div>
          <div class="info-value">${refCode ? `[${refCode}] ` : ""}${title}</div>
        </div>

        <div class="reason-box" style="border-left-color: #16a34a; background-color: #f0fdf4; color: #166534;">
          <strong>Các trường thông tin được phép cập nhật:</strong><br/>
          ${allowedFields}
        </div>

        <p>Vui lòng đăng nhập trang tra cứu để chỉnh sửa các thông tin đã được cho phép và gửi lại hồ sơ cho Ban tổ chức xét duyệt lại.</p>

        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" style="background-color: #16a34a;" target="_blank">Cập nhật hồ sơ ngay</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.PROFILE_REVISION_REQUESTED: {
      const leaderName = String(payload.leaderName || payload.submitterName || "Trưởng nhóm");
      const title = String(payload.title || payload.ideaTitle || "Đề tài");
      const refCode = String(payload.referenceCode || "");
      const reason = String(payload.reason || "Vui lòng kiểm tra và bổ sung thông tin thành viên.");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : "";

      const subject = `[UTT - Sáng tạo 4.0] Yêu cầu bổ sung hồ sơ đề tài "${title}"`;
      const text = `Kính gửi ${leaderName},

Hồ sơ đề tài "${title}" (${refCode}) của nhóm bạn cần được bổ sung/chỉnh sửa theo ý kiến của Ban tổ chức:

"${reason}"

Vui lòng truy cập trang tra cứu để cập nhật thông tin và gửi lại hồ sơ:
${lookupUrl}

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p>Ban tổ chức đã kiểm tra hồ sơ đề tài của nhóm bạn và yêu cầu bổ sung/chỉnh sửa một số thông tin:</p>

        <div class="info-box">
          <div class="info-label">Đề tài</div>
          <div class="info-value">${refCode ? `[${refCode}] ` : ""}${title}</div>
        </div>

        <div class="reason-box">
          <strong>Yêu cầu bổ sung từ Ban tổ chức:</strong><br/>
          ${reason}
        </div>

        <p>Vui lòng truy cập trang tra cứu để điều chỉnh thông tin thành viên và gửi lại hồ sơ trong thời gian sớm nhất.</p>

        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" target="_blank">Bổ sung hồ sơ đề tài</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.PROFILE_COMPLETED: {
      const leaderName = String(payload.leaderName || payload.submitterName || "Trưởng nhóm");
      const title = String(payload.title || payload.ideaTitle || "Đề tài");
      const refCode = String(payload.referenceCode || "");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : "";

      const subject = `[UTT - Sáng tạo 4.0] Xác nhận hồ sơ đề tài "${title}" đã hoàn tất`;
      const text = `Kính gửi ${leaderName},

Ban tổ chức Cuộc thi Thử thách Sáng tạo 4.0 UTT trân trọng thông báo:
Hồ sơ đề tài "${title}" (${refCode}) đã được Ban tổ chức kiểm tra và xác nhận HOÀN TẤT chính thức.

Bạn có thể tra cứu thông tin hồ sơ tại:
${lookupUrl}

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p>Ban tổ chức Cuộc thi Thử thách Sáng tạo 4.0 UTT trân trọng thông báo:</p>

        <div class="info-box">
          <div class="info-label">Đề tài chính thức hoàn tất</div>
          <div class="info-value">${refCode ? `[${refCode}] ` : ""}${title}</div>
        </div>

        <div class="reason-box" style="border-left-color: #16a34a; background-color: #f0fdf4; color: #166534;">
          <strong>Trạng thái: Đã hoàn tất (COMPLETED)</strong><br/>
          Toàn bộ thông tin thành viên và Giảng viên hướng dẫn đã được ghi nhận vào hệ thống cuộc thi.
        </div>

        <p>Chúc nhóm của bạn đạt kết quả xuất sắc trong các vòng thi tiếp theo!</p>

        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" style="background-color: #16a34a;" target="_blank">Xem hồ sơ hoàn tất</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.VERIFY_TASK_APPLICATION: {
      const leaderName = String(payload.leaderName || "Trưởng nhóm");
      const taskTitle = String(payload.taskTitle || "Nhiệm vụ đặt hàng");
      const otp = String(payload.otp || "");
      const expiresMinutes = Number(payload.expiresMinutes || 10);

      const subject = `[UTT - Sáng tạo 4.0] Mã xác thực đăng ký nhiệm vụ "${taskTitle}": ${otp}`;
      const text = `Kính gửi ${leaderName},

Bạn hoặc một người đại diện đang thực hiện đăng ký hồ sơ tham gia giải quyết nhiệm vụ: "${taskTitle}".

Mã xác thực OTP (6 chữ số) của bạn là:

${otp}

Mã này có hiệu lực trong vòng ${expiresMinutes} phút và chỉ được sử dụng 1 lần.
Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email.

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p>Bạn hoặc nhóm tác giả vừa đăng ký tham gia giải quyết nhiệm vụ đặt hàng: <strong>${taskTitle}</strong>.</p>
        <p>Để hoàn tất việc gửi hồ sơ chính thức tới Ban tổ chức và xác thực quyền sở hữu email của trưởng nhóm, vui lòng sử dụng mã OTP 6 chữ số dưới đây:</p>

        <div style="background: #f8fafc; border: 2px dashed #0284c7; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="display: block; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Mã xác thực email (OTP)</span>
          <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284c7; font-family: monospace;">${otp}</span>
          <span style="display: block; font-size: 12px; color: #94a3b8; margin-top: 8px;">Mã có hiệu lực trong vòng ${expiresMinutes} phút (nhập sai tối đa 5 lần)</span>
        </div>

        <p style="font-size: 13px; color: #64748b; margin-top: 16px;">
          Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này. Không chia sẻ mã xác thực cho bất kỳ ai để đảm bảo an toàn cho hồ sơ của bạn.
        </p>
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.TASK_APPLICATION_SUBMITTED: {
      const leaderName = String(payload.leaderName || "Trưởng nhóm");
      const taskTitle = String(payload.taskTitle || "Nhiệm vụ đặt hàng");
      const orderingOrg = String(payload.orderingOrganization || "Đơn vị đặt hàng");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : "";

      const subject = `[UTT - Sáng tạo 4.0] Tiếp nhận hồ sơ đăng ký nhiệm vụ "${taskTitle}"`;
      const text = `Kính gửi ${leaderName},

Ban tổ chức Cuộc thi Thử thách Sáng tạo 4.0 UTT trân trọng thông báo đã tiếp nhận hồ sơ đăng ký thực hiện nhiệm vụ của nhóm bạn:

- Nhiệm vụ: ${taskTitle}
- Đơn vị đặt hàng: ${orderingOrg}

Hồ sơ của nhóm bạn đã được ghi nhận và chuyển tới Ban tổ chức và đơn vị đặt hàng để xem xét lựa chọn nhóm thực hiện.
${lookupUrl ? `\nBạn có thể theo dõi tiến độ xét chọn tại liên kết tra cứu cá nhân:\n${lookupUrl}\n` : ""}
Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p>Ban tổ chức Cuộc thi Thử thách Sáng tạo 4.0 UTT đã tiếp nhận hồ sơ đăng ký giải quyết nhiệm vụ đặt hàng từ nhóm của bạn.</p>

        <div class="info-box">
          <div class="info-label">Nhiệm vụ đặt hàng</div>
          <div class="info-value">${taskTitle}</div>
          <p style="margin: 8px 0 0; font-size: 14px; color: #334155;"><strong>Đơn vị đặt hàng:</strong> ${orderingOrg}</p>
        </div>

        <p>Hồ sơ và đề xuất giải pháp của nhóm bạn đang được Hội đồng chuyên môn xem xét. Kết quả lựa chọn nhóm thực hiện sẽ được thông báo sớm nhất qua email này.</p>

        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" target="_blank">Theo dõi tiến độ hồ sơ</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.TASK_APPLICATION_SELECTED: {
      const leaderName = String(payload.leaderName || "Trưởng nhóm");
      const taskTitle = String(payload.taskTitle || "Nhiệm vụ đặt hàng");
      const orderingOrg = String(payload.orderingOrganization || "Đơn vị đặt hàng");
      const adminNote = payload.adminNote ? String(payload.adminNote) : "";
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : "";

      const subject = `[UTT - Sáng tạo 4.0] Chúc mừng! Nhóm bạn đã được chọn thực hiện nhiệm vụ "${taskTitle}"`;
      const text = `Kính gửi ${leaderName},

🎉 CHÚC MỪNG BẠN VÀ NHÓM TÁC GIẢ!

Ban tổ chức Cuộc thi Thử thách Sáng tạo 4.0 UTT trân trọng thông báo hồ sơ đề xuất của nhóm bạn ĐÃ ĐƯỢC LỰA CHỌN để trực tiếp thực hiện nhiệm vụ đặt hàng:

- Nhiệm vụ: ${taskTitle}
- Đơn vị đặt hàng: ${orderingOrg}
${adminNote ? `- Ghi chú từ Ban tổ chức: ${adminNote}\n` : ""}
Ban tổ chức sẽ liên hệ và kết nối nhóm với đại diện đơn vị đặt hàng để triển khai giải pháp trong thời gian tới.
${lookupUrl ? `\nChi tiết hồ sơ và cập nhật mới nhất tại:\n${lookupUrl}\n` : ""}
Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p style="color: #16a34a; font-weight: 700; font-size: 18px;">🎉 CHÚC MỪNG BẠN VÀ NHÓM TÁC GIẢ!</p>
        <p>Ban tổ chức trân trọng thông báo hồ sơ của nhóm bạn <strong>ĐÃ ĐƯỢC LỰA CHỌN</strong> để thực hiện bài toán thực tiễn từ doanh nghiệp / đơn vị đặt hàng.</p>

        <div class="info-box" style="border-left: 4px solid #16a34a;">
          <div class="info-label">Nhiệm vụ được giao</div>
          <div class="info-value" style="color: #16a34a;">${taskTitle}</div>
          <p style="margin: 8px 0 0; font-size: 14px; color: #334155;"><strong>Đơn vị đặt hàng:</strong> ${orderingOrg}</p>
        </div>

        ${
          adminNote
            ? `
        <div class="reason-box" style="border-left-color: #16a34a; background-color: #f0fdf4; color: #166534;">
          <strong>Nhắn gửi từ Ban tổ chức:</strong><br/>
          ${adminNote}
        </div>
        `
            : ""
        }

        <p>Ban tổ chức sẽ sớm kết nối nhóm của bạn với người hướng dẫn chuyên môn và đại diện đơn vị đặt hàng.</p>

        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" style="background-color: #16a34a;" target="_blank">Xem chi tiết nhiệm vụ đã giao</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.TASK_APPLICATION_NOT_SELECTED: {
      const leaderName = String(payload.leaderName || "Trưởng nhóm");
      const taskTitle = String(payload.taskTitle || "Nhiệm vụ đặt hàng");
      const orderingOrg = String(payload.orderingOrganization || "Đơn vị đặt hàng");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : "";

      const subject = `[UTT - Sáng tạo 4.0] Thông báo kết quả lựa chọn nhiệm vụ "${taskTitle}"`;
      const text = `Kính gửi ${leaderName},

Cảm ơn bạn và nhóm đã quan tâm đăng ký thực hiện nhiệm vụ "${taskTitle}" từ ${orderingOrg}.

Sau quá trình thẩm định kỹ lưỡng các đề xuất giải pháp, Ban tổ chức và đơn vị đặt hàng đã lựa chọn nhóm giải pháp phù hợp nhất với tiêu chí kỹ thuật đợt này. Vì số lượng nhóm thực hiện có hạn, rất tiếc hồ sơ của nhóm bạn chưa được lựa chọn trong đợt này.

Ban tổ chức ghi nhận tinh thần nhiệt huyết của nhóm và hy vọng tiếp tục đón nhận đề xuất của bạn ở các nhiệm vụ và bài toán sắp tới!
${lookupUrl ? `\nBạn có thể tra cứu thông tin hồ sơ tại:\n${lookupUrl}\n` : ""}
Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p>Cảm ơn bạn và nhóm tác giả đã dành tâm huyết gửi đề xuất thực hiện nhiệm vụ <strong>"${taskTitle}"</strong> từ <strong>${orderingOrg}</strong>.</p>

        <div class="info-box">
          <div class="info-label">Nhiệm vụ</div>
          <div class="info-value" style="color: #64748b;">${taskTitle}</div>
        </div>

        <p>Sau khi xem xét kỹ lưỡng các phương án, Ban tổ chức và đơn vị đặt hàng đã lựa chọn nhóm giải pháp tối ưu nhất cho đợt triển khai này. Rất tiếc nhóm của bạn chưa được lựa chọn đợt này.</p>
        <p>Ban tổ chức đánh giá cao năng lực và tinh thần đổi mới sáng tạo của nhóm, và kính mời bạn tiếp tục theo dõi Sảnh nhiệm vụ để đăng ký các bài toán mới!</p>

        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" style="background-color: #64748b;" target="_blank">Xem danh sách hồ sơ</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.TASK_ASSIGNED: {
      const leaderName = String(payload.leaderName || "Trưởng nhóm");
      const taskTitle = String(payload.taskTitle || "Nhiệm vụ");
      const orderingOrg = String(payload.orderingOrganization || "Đơn vị đặt hàng");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : "";

      const subject = `[UTT - Sáng tạo 4.0] Nhiệm vụ "${taskTitle}" đã được giao cho nhóm thực hiện`;
      const text = `Kính gửi ${leaderName},

Nhiệm vụ "${taskTitle}" (Đơn vị đặt hàng: ${orderingOrg}) đã chính thức chuyển sang trạng thái ĐÃ GIAO NHÓM (ASSIGNED).

Bạn có thể theo dõi chi tiết tại:
${lookupUrl}

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p>Nhiệm vụ <strong>"${taskTitle}"</strong> của đơn vị <strong>${orderingOrg}</strong> đã chính thức được chuyển sang trạng thái <strong>ĐÃ GIAO NHÓM (ASSIGNED)</strong>.</p>
        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" target="_blank">Xem thông tin nhiệm vụ</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.TASK_COMPLETED: {
      const leaderName = String(payload.leaderName || "Trưởng nhóm");
      const taskTitle = String(payload.taskTitle || "Nhiệm vụ");
      const orderingOrg = String(payload.orderingOrganization || "Đơn vị đặt hàng");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : "";

      const subject = `[UTT - Sáng tạo 4.0] Chúc mừng hoàn thành nhiệm vụ "${taskTitle}"`;
      const text = `Kính gửi ${leaderName},

Ban tổ chức Cuộc thi Thử thách Sáng tạo 4.0 UTT trân trọng chúc mừng nhóm bạn đã hoàn thành xuất sắc nhiệm vụ "${taskTitle}" từ ${orderingOrg}.

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p style="color: #16a34a; font-weight: 700; font-size: 18px;">🎉 CHÚC MỪNG HOÀN THÀNH NHIỆM VỤ!</p>
        <p>Ban tổ chức và đơn vị đặt hàng <strong>${orderingOrg}</strong> trân trọng chúc mừng nhóm bạn đã hoàn thành xuất sắc nhiệm vụ <strong>"${taskTitle}"</strong>.</p>
        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" style="background-color: #16a34a;" target="_blank">Xem kết quả nhiệm vụ</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.RECRUITMENT_APPLICATION_OTP: {
      const candidateName = String(payload.candidateName || "Ứng viên");
      const postTitle = String(payload.postTitle || "Đề tài nghiên cứu");
      const ideaTitle = String(payload.ideaTitle || postTitle);
      const otp = String(payload.otp || "------");
      const expiresMinutes = Number(payload.expiresMinutes || 10);

      const subject = `[UTT - Sáng tạo 4.0] Mã xác thực ứng tuyển đề tài: ${postTitle}`;
      const text = `Kính gửi ${candidateName},

Bạn vừa nộp đơn đăng ký ứng tuyển tham gia đề tài "${ideaTitle}" (Tin tuyển dụng: ${postTitle}) tại Hội chợ ý tưởng Cuộc thi Thử thách Sáng tạo 4.0 UTT.

Để hoàn tất việc gửi hồ sơ tới Trưởng nhóm đề tài và xác thực quyền sở hữu email của bạn, vui lòng nhập mã OTP 6 chữ số dưới đây:
${otp}

(Mã xác thực có hiệu lực trong vòng ${expiresMinutes} phút và cho phép nhập sai tối đa 5 lần).

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${candidateName},</div>
        <p>Bạn vừa nộp đơn ứng tuyển tham gia đề tài: <strong>${ideaTitle}</strong> tại <em>Hội chợ ý tưởng</em>.</p>
        <p>Để hoàn tất việc gửi hồ sơ tới Trưởng nhóm đề tài và xác thực quyền sở hữu email của bạn, vui lòng nhập mã OTP 6 chữ số dưới đây:</p>

        <div style="background: #f8fafc; border: 2px dashed #f97316; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="display: block; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Mã xác thực ứng tuyển (OTP)</span>
          <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ea580c; font-family: monospace;">${otp}</span>
          <span style="display: block; font-size: 12px; color: #94a3b8; margin-top: 8px;">Mã có hiệu lực trong vòng ${expiresMinutes} phút (nhập sai tối đa 5 lần)</span>
        </div>

        <p style="font-size: 13px; color: #64748b; margin-top: 16px;">
          Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email. Không chia sẻ mã xác thực cho bất kỳ ai.
        </p>
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.RECRUITMENT_APPLICATION_VERIFIED_LEADER_NOTICE: {
      const leaderName = String(payload.leaderName || "Trưởng nhóm");
      const ideaTitle = String(payload.ideaTitle || "Đề tài");
      const candidateName = String(payload.candidateName || "Ứng viên");
      const candidateStudentCode = String(payload.candidateStudentCode || "");
      const candidateSpecialty = String(payload.candidateSpecialty || "");
      const lookupUrl = payload.lookupUrl ? String(payload.lookupUrl) : "";

      const subject = `[UTT - Sáng tạo 4.0] Ứng viên mới đăng ký tham gia đề tài "${ideaTitle}"`;
      const text = `Kính gửi ${leaderName},

Tin tuyển dụng thành viên của đề tài "${ideaTitle}" vừa nhận được một hồ sơ ứng tuyển mới:

- Họ và tên ứng viên: ${candidateName}
- Mã sinh viên: ${candidateStudentCode}
- Chuyên môn / kỹ năng: ${candidateSpecialty}

Ứng viên đã hoàn tất xác thực email. Bạn vui lòng truy cập đường dẫn tra cứu cá nhân của Trưởng nhóm để xem toàn bộ hồ sơ chi tiết và thực hiện xét duyệt (Tiếp nhận hoặc Từ chối):
${lookupUrl}

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${leaderName},</div>
        <p>Tin tuyển dụng của đề tài <strong>"${ideaTitle}"</strong> vừa tiếp nhận một hồ sơ ứng tuyển mới từ Hội chợ ý tưởng.</p>

        <div class="info-box">
          <div class="info-label">Thông tin ứng viên mới</div>
          <p style="margin: 6px 0; font-size: 15px; font-weight: 600; color: #0f172a;">${candidateName} ${candidateStudentCode ? `(${candidateStudentCode})` : ""}</p>
          <p style="margin: 4px 0; font-size: 14px; color: #475569;"><strong>Chuyên môn / Thế mạnh:</strong> ${candidateSpecialty}</p>
        </div>

        <p>Ứng viên đã xác thực email thành công. Bạn có thể xem xét hồ sơ, nguyện vọng và đưa ra quyết định tuyển dụng.</p>

        ${
          lookupUrl
            ? `
        <div class="btn-container">
          <a href="${lookupUrl}" class="btn" target="_blank">Xét duyệt hồ sơ ứng viên</a>
        </div>
        `
            : ""
        }
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.RECRUITMENT_APPLICATION_ACCEPTED: {
      const candidateName = String(payload.candidateName || "Bạn");
      const ideaTitle = String(payload.ideaTitle || "Đề tài");
      const leaderName = String(payload.leaderName || "Trưởng nhóm");
      const leaderEmail = payload.leaderEmail ? String(payload.leaderEmail) : "";
      const reviewNote = payload.reviewNote ? String(payload.reviewNote) : "";

      const subject = `[UTT - Sáng tạo 4.0] Chúc mừng! Đơn ứng tuyển đề tài "${ideaTitle}" đã được chấp thuận`;
      const text = `Kính gửi ${candidateName},

Chúc mừng bạn! Trưởng nhóm đề tài "${ideaTitle}" (${leaderName}) đã chính thức chấp thuận đơn đăng ký ứng tuyển của bạn.
Bạn hiện đã là thành viên chính thức trong nhóm nghiên cứu của đề tài.

${reviewNote ? `Ghi chú từ Trưởng nhóm: ${reviewNote}\n` : ""}${leaderEmail ? `Email liên hệ Trưởng nhóm: ${leaderEmail}\n` : ""}
Vui lòng chủ động liên hệ với Trưởng nhóm để phối hợp triển khai các bước tiếp theo.

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${candidateName},</div>
        <p style="color: #16a34a; font-weight: 700; font-size: 18px;">🎉 CHÚC MỪNG BẠN ĐÃ ĐƯỢC TIẾP NHẬN VÀO NHÓM!</p>
        <p>Trưởng nhóm <strong>${leaderName}</strong> của đề tài <strong>"${ideaTitle}"</strong> đã phê duyệt đơn ứng tuyển của bạn tại Hội chợ ý tưởng.</p>

        <div class="info-box" style="border-left-color: #16a34a;">
          <div class="info-label">Đề tài tham gia</div>
          <div class="info-value" style="color: #16a34a;">${ideaTitle}</div>
          <p style="margin: 8px 0 0; font-size: 14px; color: #334155;"><strong>Trưởng nhóm:</strong> ${leaderName}</p>
          ${leaderEmail ? `<p style="margin: 4px 0 0; font-size: 14px; color: #334155;"><strong>Email liên hệ:</strong> <a href="mailto:${leaderEmail}">${leaderEmail}</a></p>` : ""}
          ${reviewNote ? `<p style="margin: 8px 0 0; font-size: 13px; color: #475569; font-style: italic;"><strong>Lời nhắn:</strong> "${reviewNote}"</p>` : ""}
        </div>

        <p>Hồ sơ của bạn đã được bổ sung vào danh sách thành viên đề tài. Hãy chủ động liên lạc với Trưởng nhóm để cùng nghiên cứu và hoàn thiện sản phẩm dự thi.</p>
      `,
      );

      return { subject, text, html };
    }

    case EmailJobType.RECRUITMENT_APPLICATION_REJECTED: {
      const candidateName = String(payload.candidateName || "Bạn");
      const ideaTitle = String(payload.ideaTitle || "Đề tài");
      const reviewNote = payload.reviewNote ? String(payload.reviewNote) : "";

      const subject = `[UTT - Sáng tạo 4.0] Thông báo kết quả ứng tuyển đề tài "${ideaTitle}"`;
      const text = `Kính gửi ${candidateName},

Cảm ơn bạn đã quan tâm và nộp hồ sơ ứng tuyển tham gia đề tài "${ideaTitle}" tại Hội chợ ý tưởng.

Rất tiếc, tại thời điểm này Trưởng nhóm chưa thể tiếp nhận bạn vào nhóm do số lượng vị trí tuyển dụng có hạn hoặc yêu cầu chuyên môn chưa thực sự phù hợp.
${reviewNote ? `Lý do / Lời nhắn: ${reviewNote}\n` : ""}
Bạn có thể tiếp tục tham khảo và ứng tuyển các đề tài khác đang mở tuyển trên Hội chợ ý tưởng Cuộc thi Thử thách Sáng tạo 4.0 UTT.

Trân trọng,
Ban tổ chức Cuộc thi Sáng tạo UTT
Email hỗ trợ: i4t@utt.edu.vn`;

      const html = baseHtmlLayout(
        subject,
        `
        <div class="greeting">Kính gửi ${candidateName},</div>
        <p>Cảm ơn bạn đã quan tâm và gửi hồ sơ ứng tuyển đề tài <strong>"${ideaTitle}"</strong> tại Hội chợ ý tưởng.</p>
        <p>Do chỉ tiêu tuyển thành viên có hạn hoặc sự phù hợp về phân công nhiệm vụ, Trưởng nhóm hiện chưa thể tiếp nhận hồ sơ của bạn vào thời điểm này.</p>

        ${
          reviewNote
            ? `
        <div class="info-box" style="border-left-color: #64748b;">
          <div class="info-label">Ghi chú từ Trưởng nhóm</div>
          <p style="margin: 4px 0 0; font-size: 14px; color: #475569;">${reviewNote}</p>
        </div>
        `
            : ""
        }

        <p>Vẫn còn nhiều đề tài xuất sắc khác đang tìm kiếm cộng sự tại Hội chợ ý tưởng. Chúc bạn sớm tìm được đề tài phù hợp với năng lực và đam mê của mình!</p>

        <div class="btn-container">
          <a href="/hoi-cho-y-tuong" class="btn" target="_blank">Khám phá các đề tài khác</a>
        </div>
      `,
      );

      return { subject, text, html };
    }

    default: {
      throw new Error(`Unsupported EmailJobType: ${String(type)}`);
    }
  }
}
