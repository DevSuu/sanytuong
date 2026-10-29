import "dotenv/config";
import { getDb } from "../src/lib/db";
import { hashPassword } from "better-auth/crypto";

/**
 * CLI Utility: Create or update an ADMIN account safely via environment variables.
 *
 * Usage:
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=strong_password_here ADMIN_NAME="Quản trị viên BTC" npx tsx scripts/create-admin-users.ts
 */
async function upsertAdminAccount() {
  const username = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  const password = (process.env.ADMIN_PASSWORD || "").trim();
  const displayName = (process.env.ADMIN_NAME || "Quản trị viên UTT").trim();

  if (!username || !password) {
    console.error(
      "Thiếu biến môi trường bắt buộc.\n" +
        'Cách dùng: ADMIN_USERNAME=admin ADMIN_PASSWORD="<mat_khau_manh>" ADMIN_NAME="Quản trị viên BTC" npx tsx scripts/create-admin-users.ts'
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Lỗi: ADMIN_PASSWORD phải có ít nhất 8 ký tự.");
    process.exit(1);
  }

  const internalEmail = username.includes("@")
    ? username
    : `${username}@localhost.local`;

  const db = getDb();
  try {
    const hashedPassword = await hashPassword(password);

    let user = await db.user.findUnique({
      where: { email: internalEmail },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          name: displayName,
          email: internalEmail,
          emailVerified: true,
          role: "ADMIN",
        },
      });
      console.log(`✓ Đã tạo tài khoản quản trị mới: ${displayName} (${username})`);
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          name: displayName,
          role: "ADMIN",
          emailVerified: true,
        },
      });
      console.log(`✓ Đã cập nhật thông tin quản trị: ${displayName} (${username})`);
    }

    const existingAccount = await db.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });

    if (existingAccount) {
      await db.account.update({
        where: { id: existingAccount.id },
        data: { password: hashedPassword },
      });
      console.log(`✓ Đã cập nhật mật khẩu cho tài khoản: ${username}`);
    } else {
      await db.account.create({
        data: {
          id: `acc-${username}-${Date.now()}`,
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });
      console.log(`✓ Đã khởi tạo mật khẩu đăng nhập cho tài khoản: ${username}`);
    }
  } finally {
    await db.$disconnect();
  }
}

upsertAdminAccount().catch((err) => {
  console.error(err);
  process.exit(1);
});
