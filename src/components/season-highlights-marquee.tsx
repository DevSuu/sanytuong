"use client";
import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface HighlightItem {
  id: string;
  imageUrl: string;
  title?: string;
}

const INITIAL_FALLBACK: HighlightItem[] = [
  { id: "init-1", imageUrl: "/images/traffic-ai.webp" },
  { id: "init-2", imageUrl: "/images/robot.webp" },
  { id: "init-3", imageUrl: "/images/vr.webp" },
  { id: "init-4", imageUrl: "/images/solar.webp" },
];

export function SeasonHighlightsMarquee() {
  const [items, setItems] = useState<HighlightItem[]>(INITIAL_FALLBACK);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;

    const fetchHighlights = async () => {
      try {
        const res = await fetch("/api/highlights", { cache: "no-store" });
        const data = await res.json();
        if (!ignore && res.ok && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
        }
      } catch {
        // Keep fallback on network error
      }
    };

    fetchHighlights();

    const onFocus = () => fetchHighlights();
    window.addEventListener("focus", onFocus);
    return () => {
      ignore = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Build a half-track with at least 6 items so even 1-3 uploaded photos fill wide screens seamlessly
  const halfTrack = useMemo(() => {
    const source = items.length > 0 ? items : INITIAL_FALLBACK;
    const minCount = 6;
    const result: { item: HighlightItem; originalIndex: number; key: string }[] = [];
    let copyIdx = 0;
    while (result.length < minCount || copyIdx === 0) {
      source.forEach((item, idx) => {
        result.push({
          item,
          originalIndex: idx,
          key: `${item.id}-c${copyIdx}-i${idx}`,
        });
      });
      copyIdx++;
    }
    return result;
  }, [items]);

  // Adjust animation duration proportionally to number of items in halfTrack so speed stays constant
  const durationSeconds = Math.max(24, halfTrack.length * 4.5);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeIndex === null) return;
    setActiveIndex((activeIndex - 1 + items.length) % items.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeIndex === null) return;
    setActiveIndex((activeIndex + 1) % items.length);
  };

  return (
    <>
      <style>{`
        @keyframes uttSeasonMarquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .utt-marquee-viewport {
          position: relative;
          width: 100%;
          overflow: hidden;
          padding: 8px 0 14px;
          mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 4%,
            black 96%,
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 4%,
            black 96%,
            transparent 100%
          );
        }
        .utt-marquee-track {
          display: flex;
          width: max-content;
          animation: uttSeasonMarquee ${durationSeconds}s linear infinite;
          will-change: transform;
        }
        .utt-marquee-viewport:hover .utt-marquee-track {
          animation-play-state: paused;
        }
        .utt-marquee-card {
          position: relative;
          width: 370px;
          height: 245px;
          margin-right: 20px;
          border-radius: 16px;
          overflow: hidden;
          flex-shrink: 0;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.45);
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .utt-marquee-card:hover {
          transform: translateY(-4px) scale(1.015);
          border-color: rgba(249, 115, 22, 0.65);
          box-shadow: 0 18px 36px -8px rgba(249, 115, 22, 0.25);
        }
        .utt-marquee-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.45s ease;
        }
        .utt-marquee-card:hover img {
          transform: scale(1.04);
        }
        @media (max-width: 768px) {
          .utt-marquee-card {
            width: 280px;
            height: 190px;
            margin-right: 14px;
            border-radius: 12px;
          }
        }
      `}</style>

      <div className="utt-marquee-viewport" aria-label="Băng chuyền ảnh Dấu ấn mùa 1">
        <div className="utt-marquee-track">
          {/* First half */}
          {halfTrack.map(({ item, originalIndex, key }) => (
            <div
              key={`a-${key}`}
              className="utt-marquee-card"
              onClick={() => setActiveIndex(originalIndex)}
              title="Bấm để phóng to ảnh"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title || "Dấu ấn mùa 1"}
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
          {/* Second half (exact duplicate for seamless -50% loop) */}
          {halfTrack.map(({ item, originalIndex, key }) => (
            <div
              key={`b-${key}`}
              className="utt-marquee-card"
              onClick={() => setActiveIndex(originalIndex)}
              title="Bấm để phóng to ảnh"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title || "Dấu ấn mùa 1"}
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen Lightbox when clicking a photo (Portaled to document.body so it always centers in viewport) */}
      {activeIndex !== null &&
        items[activeIndex] &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(5, 10, 24, 0.88)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setActiveIndex(null)}
          >
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              aria-label="Đóng"
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                width: 42,
                height: 42,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(15, 23, 42, 0.8)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={22} />
            </button>

            {items.length > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Ảnh trước"
                style={{
                  position: "absolute",
                  left: 20,
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={items[activeIndex].imageUrl.replace("w=564", "w=1280")}
              alt={items[activeIndex].title || "Dấu ấn mùa 1"}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "min(1080px, calc(100% - 96px))",
                maxHeight: "calc(100% - 48px)",
                objectFit: "contain",
                borderRadius: 14,
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            />

            {items.length > 1 && (
              <button
                type="button"
                onClick={handleNext}
                aria-label="Ảnh tiếp theo"
                style={{
                  position: "absolute",
                  right: 20,
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
