"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppNavigation, TabKey } from "@/context/navigation-context";

const navLinks: { key: TabKey; label: string }[] = [
  { key: "home", label: "Trang chủ" },
  { key: "gui-y-tuong", label: "Gửi ý tưởng" },
  { key: "nhiem-vu", label: "Sảnh nhiệm vụ" },
  { key: "hoi-cho-y-tuong", label: "Hội chợ ý tưởng" },
  { key: "giai-thuong", label: "Sảnh giải thưởng" },
  { key: "the-le", label: "Thể lệ cuộc thi" },
  { key: "tra-cuu", label: "Tra cứu" },
];

export function SiteHeader() {
  const { currentTab, goToTab, prefetchTab } = useAppNavigation();
  const [open, setOpen] = useState(false);
  const { setTheme } = useTheme();
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <button
          type="button"
          className="brand"
          aria-label="Trường Đại học Công nghệ Giao thông vận tải (UTT) — Trang chủ"
          onClick={() => goToTab("home")}
        >
          <Image
            src="/images/utt-logo.webp"
            alt="Logo Trường Đại học Công nghệ Giao thông vận tải — UTT"
            width={112}
            height={107}
            unoptimized
            className="brand-logo"
            priority
          />
          <span className="brand-name">
            <span className="brand-name-sub">TRƯỜNG ĐẠI HỌC</span>
            <span className="brand-name-main">CÔNG NGHỆ GIAO THÔNG VẬN TẢI</span>
            <span className="brand-name-en">UNIVERSITY OF TRANSPORT TECHNOLOGY</span>
          </span>
        </button>

        <nav aria-label="Điều hướng chính" className="desktop-nav">
          {navLinks.map(({ key, label }) => (
            <button
              type="button"
              key={key}
              aria-current={currentTab === key ? "page" : undefined}
              onMouseEnter={() => prefetchTab(key)}
              onFocus={() => prefetchTab(key)}
              onClick={() => goToTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <div className="theme-switch" aria-label="Chế độ hiển thị">
            <button
              aria-label="Chế độ sáng"
              onClick={() => setTheme("light")}
              className="theme-light"
            >
              <Sun size={18} />
            </button>
            <button
              aria-label="Chế độ tối"
              onClick={() => setTheme("dark")}
              className="theme-dark"
            >
              <Moon size={17} />
            </button>
          </div>
          <Button
            ref={menuButton}
            variant="ghost"
            size="icon"
            className="menu-toggle"
            aria-label={open ? "Đóng menu" : "Mở menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        aria-label="Điều hướng di động"
        className="mobile-nav"
        hidden={!open}
      >
        {navLinks.map(({ key, label }) => (
          <button
            type="button"
            key={key}
            aria-current={currentTab === key ? "page" : undefined}
            onClick={() => {
              setOpen(false);
              goToTab(key);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
