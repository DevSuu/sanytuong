import { NavigationProvider } from "@/context/navigation-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AutoRefreshWatcher } from "@/components/auto-refresh-watcher";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavigationProvider>
      <AutoRefreshWatcher intervalMs={15000} mode="public" />
      <a className="skip-link" href="#main">
        Đến nội dung chính
      </a>
      <SiteHeader />
      <main id="main" className="public-main-stage">
        <div className="tech-40-scroll-wings" aria-hidden="true">
          {/* Tầng 1: Khu vực Hero + Bento & Bảng tin */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/tech-wing-left.webp"
            alt=""
            decoding="async"
            className="tech-wing-exact left tier-1"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/tech-wing-right.webp"
            alt=""
            decoding="async"
            className="tech-wing-exact right tier-1"
          />

          {/* Tầng 2 (Nhân đôi kéo dài): Khu vực Sảnh nhiệm vụ + Dấu ấn mùa 1 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/tech-wing-left.webp"
            alt=""
            loading="lazy"
            decoding="async"
            className="tech-wing-exact left tier-2"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/tech-wing-right.webp"
            alt=""
            loading="lazy"
            decoding="async"
            className="tech-wing-exact right tier-2"
          />

          {/* Tầng 3 (Kéo dài tới cuối trang): Khu vực Dấu ấn mùa 1 + Tra cứu ý tưởng */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/tech-wing-left.webp"
            alt=""
            loading="lazy"
            decoding="async"
            className="tech-wing-exact left tier-3"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/tech-wing-right.webp"
            alt=""
            loading="lazy"
            decoding="async"
            className="tech-wing-exact right tier-3"
          />
        </div>
        <div className="public-main-content">{children}</div>
      </main>
      <SiteFooter />
    </NavigationProvider>
  );
}
