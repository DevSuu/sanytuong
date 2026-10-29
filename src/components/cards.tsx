"use client";
import Image from "next/image";
import { ArrowRight, Bot, CarFront, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppNavigation } from "@/context/navigation-context";

export interface TaskCardItem {
  slug: string;
  title: string;
  description: string;
  category?: string | null;
  image?: string;
  imageUrl?: string | null;
  icon?: "car" | "leaf" | "bot" | string;
  reward?: string | null;
  orderingOrganization?: string | null;
}

function inferIcon(category?: string | null, icon?: string): "car" | "leaf" | "bot" {
  if (icon === "car" || icon === "leaf" || icon === "bot") return icon;
  const text = (category || "").toLowerCase();
  if (text.includes("giao thông") || text.includes("vận tải") || text.includes("đô thị")) {
    return "car";
  }
  if (text.includes("môi trường") || text.includes("năng lượng") || text.includes("xanh")) {
    return "leaf";
  }
  return "bot";
}

export function TaskCard({ task }: { task: TaskCardItem }) {
  const { goToTaskDetail } = useAppNavigation();
  const iconKind = inferIcon(task.category, task.icon);
  const Icon =
    iconKind === "car" ? CarFront : iconKind === "leaf" ? Leaf : Bot;
  const imgSrc = task.imageUrl || task.image || "/images/robot.webp";

  return (
    <article className="task-card">
      <div className="task-content">
        <Image
          src={imgSrc}
          alt={task.title}
          fill
          sizes="(max-width: 700px) 92vw, (max-width: 1024px) 45vw, 380px"
          className="task-image"
          unoptimized
        />
        <div className="task-copy">
          <div className={`task-category ${iconKind}`}>
            <span>
              <Icon size={17} />
            </span>
            {task.category || task.orderingOrganization || "Nhiệm vụ đặt hàng"}
          </div>
          <h3>{task.title}</h3>
          <p>{task.description}</p>
          <span className="status-badge">
            <span />
            {task.reward ? `Tài trợ: ${task.reward}` : "Nhiệm vụ tiêu biểu"}
          </span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="card-button"
        onClick={() => goToTaskDetail(task.slug)}
      >
        Xem nhiệm vụ <ArrowRight />
      </Button>
    </article>
  );
}
