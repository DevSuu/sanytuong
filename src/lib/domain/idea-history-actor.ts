export interface HistoryActorUser {
  id: string;
  name: string;
  role?: string | null;
}

/**
 * Format system role string to human-readable Vietnamese title.
 */
export function formatActorRole(role?: string | null): string {
  if (!role) return "Quản trị viên";
  switch (role.toUpperCase()) {
    case "ADMIN":
      return "Quản trị viên";
    case "JUDGE":
      return "Ban Giám Khảo";
    default:
      return role;
  }
}

/**
 * Resolves the display name and role for an audit history entry.
 *
 * Rules:
 * 1. System/Worker events: "Hệ thống tự động"
 * 2. Old events without actorId: "Chưa xác định tài khoản" (preserves historical integrity without guessing)
 * 3. User with known account: "<Name> (<Role>)", e.g. "Vũ Hoàng Anh (Quản trị viên)"
 * 4. User whose account was deleted: "Tài khoản đã xóa (<actorId>)"
 */
export function resolveHistoryActorDisplay(
  history: {
    actorType?: string | null;
    actorId?: string | null;
  },
  actorMap?:
    | Map<string, HistoryActorUser>
    | Record<string, HistoryActorUser>
    | null
): string {
  if (history.actorType === "SYSTEM") {
    return "Hệ thống tự động";
  }

  if (!history.actorId || history.actorId.trim() === "") {
    return "Chưa xác định tài khoản";
  }

  let actor: HistoryActorUser | undefined;
  if (actorMap instanceof Map) {
    actor = actorMap.get(history.actorId);
  } else if (actorMap && typeof actorMap === "object") {
    actor = actorMap[history.actorId];
  }

  if (!actor) {
    return `Tài khoản đã xóa (${history.actorId})`;
  }

  const roleLabel = formatActorRole(actor.role);
  return `${actor.name} (${roleLabel})`;
}
