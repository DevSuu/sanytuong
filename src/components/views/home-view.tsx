"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Grid2X2,
  Mail,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard, TaskCardItem } from "@/components/cards";
import { LookupForm } from "@/components/lookup-form";
import { SeasonHighlightsMarquee } from "@/components/season-highlights-marquee";
import { HomeBentoNewsSection } from "@/components/home-bento-news-section";
import { useAppNavigation } from "@/context/navigation-context";

export function HomeView() {
  const { goToTab } = useAppNavigation();
  const [featuredTasks, setFeaturedTasks] = useState<TaskCardItem[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);

  useEffect(() => {
    let ignore = false;
    const loadTasks = async () => {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();
        if (!ignore && res.ok && Array.isArray(data.tasks)) {
          // Prioritize OPEN tasks first, up to 3 tasks
          const sorted = [...data.tasks].sort((a, b) => {
            if (a.status === "OPEN" && b.status !== "OPEN") return -1;
            if (a.status !== "OPEN" && b.status === "OPEN") return 1;
            return 0;
          });
          setFeaturedTasks(sorted.slice(0, 3));
        }
      } catch {
        // Ignore network error
      } finally {
        if (!ignore) setTasksLoaded(true);
      }
    };
    loadTasks();
    window.addEventListener("focus", loadTasks);
    return () => {
      ignore = true;
      window.removeEventListener("focus", loadTasks);
    };
  }, []);

  return (
    <>
      <div className="tech-40-exact-stage">
        <section className="hero">
          <div className="container hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">THỬ THÁCH SÁNG TẠO 4.0</p>
              <h1>
                Khơi nguồn ý tưởng.
                <br />
                Bứt phá tương lai.
              </h1>
              <p className="hero-description">
                Nơi sinh viên UTT đề xuất ý tưởng và giải quyết những bài toán
                thực tiễn.
              </p>
              <div className="hero-buttons">
                <Button
                  size="lg"
                  onClick={() => goToTab("gui-y-tuong")}
                  id="hero-btn-gui-y-tuong"
                >
                  <Send />
                  Gửi ý tưởng
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => goToTab("nhiem-vu")}
                  id="hero-btn-nhiem-vu"
                >
                  <Grid2X2 />
                  Khám phá nhiệm vụ
                </Button>
              </div>
            </div>
            <div className="hero-art">
              <Image
                src="/images/hero-students.webp"
                alt="Minh họa AI: nhóm sinh viên cùng phát triển mô hình giao thông và robot"
                fill
                priority
                fetchPriority="high"
                unoptimized
                sizes="(max-width: 700px) 100vw, 1536px"
              />
              <span className="hero-note">
                Cùng kiến tạo
                <br />
                những điều tốt đẹp hơn.
              </span>
            </div>
          </div>
        </section>

        <HomeBentoNewsSection />
      </div>

      <section className="tasks-section section-space">
        <div className="container">
          <div className="section-heading">
            <div>
              <h2>Sảnh nhiệm vụ – treo thưởng</h2>
              <p>
                Từ bài toán thực tiễn đến giải pháp của bạn{" "}
                <span className="demo-label">Tiêu biểu</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => goToTab("nhiem-vu")}
              className="see-all"
            >
              Xem tất cả <ArrowRight size={18} />
            </button>
          </div>
          <div className="three-grid">
            {featuredTasks.map((task) => (
              <TaskCard key={task.slug} task={task} />
            ))}
          </div>
          {tasksLoaded && featuredTasks.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "32px 20px",
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--muted)",
                fontSize: 14,
              }}
            >
              Hiện chưa có nhiệm vụ đặt hàng nào đang mở đăng ký.
            </div>
          )}
        </div>
      </section>

      <section className="container awards-section section-space">
        <div className="section-heading">
          <div>
            <h2>Dấu ấn mùa 1</h2>
            <p>
              Không gian vinh danh các công trình và giải pháp sáng tạo{" "}
              <span className="demo-label">Season 1</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => goToTab("giai-thuong")}
            className="see-all"
          >
            Xem tất cả <ArrowRight size={18} />
          </button>
        </div>
        <SeasonHighlightsMarquee />
      </section>

      <section className="container">
        <div className="lookup-banner">
          <div className="lookup-title">
            <span className="feature-icon blue">
              <Mail />
            </span>
            <div>
              <h2>Tra cứu ý tưởng của bạn</h2>
              <p>Một email – một đường link cho tất cả ý tưởng.</p>
            </div>
          </div>
          <LookupForm />
        </div>
      </section>
    </>
  );
}
