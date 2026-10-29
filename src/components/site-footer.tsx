"use client";
import { useAppNavigation } from "@/context/navigation-context";

export function SiteFooter() {
  const { goToTab } = useAppNavigation();

  return (
    <footer className="container site-footer">
      <p>
        <strong>UTT</strong>
        <span>•</span>Thử thách sáng tạo 4.0
      </p>
      <div>
        <p>
          <a
            href="/the-le"
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                goToTab("the-le");
              }
            }}
          >
            Thể lệ
          </a>
          <span>·</span>
          <a
            href="https://www.facebook.com/share/1LyF6fTocV/?mibextid=wwXIfr"
            target="_blank"
            rel="noopener noreferrer"
          >
            Liên hệ hỗ trợ
          </a>
        </p>
      </div>
    </footer>
  );
}
