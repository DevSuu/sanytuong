"use client";

import { useEffect } from "react";

export function LookupTokenSync({ token }: { token: string }) {
  useEffect(() => {
    if (!token || typeof window === "undefined") return;
    try {
      window.localStorage.setItem("utt_lookup_token", token.trim());
    } catch {
      // Ignore storage access errors in private browsing mode
    }
  }, [token]);

  return null;
}
