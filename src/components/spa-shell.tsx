"use client";
import React from "react";
import dynamic from "next/dynamic";
import { useAppNavigation } from "@/context/navigation-context";
import { HomeView } from "@/components/views/home-view";

const SubmitIdeaView = dynamic(() =>
  import("@/components/views/submit-idea-view").then((m) => m.SubmitIdeaView)
);
const TasksView = dynamic(() =>
  import("@/components/views/tasks-view").then((m) => m.TasksView)
);
const IdeaFairView = dynamic(() =>
  import("@/components/views/idea-fair-view").then((m) => m.IdeaFairView)
);
const AwardsView = dynamic(() =>
  import("@/components/views/awards-view").then((m) => m.AwardsView)
);
const LookupView = dynamic(() =>
  import("@/components/views/lookup-view").then((m) => m.LookupView)
);
const RulesView = dynamic(() =>
  import("@/components/views/rules-view").then((m) => m.RulesView)
);
const ContactView = dynamic(() =>
  import("@/components/views/contact-view").then((m) => m.ContactView)
);

export function SpaShell() {
  const { currentTab, selectedTaskSlug, direction, isPopState } = useAppNavigation();

  const renderCurrentView = () => {
    switch (currentTab) {
      case "home":
        return <HomeView />;
      case "gui-y-tuong":
        return <SubmitIdeaView />;
      case "nhiem-vu":
        return <TasksView />;
      case "hoi-cho-y-tuong":
        return <IdeaFairView />;
      case "giai-thuong":
        return <AwardsView />;
      case "tra-cuu":
        return <LookupView />;
      case "the-le":
        return <RulesView />;
      case "lien-he":
        return <ContactView />;
      default:
        return <HomeView />;
    }
  };

  const animClass = isPopState
    ? "spa-popstate"
    : direction === "forward"
    ? "spa-slide-forward"
    : "spa-slide-back";
  const transitionKey = `${currentTab}-${selectedTaskSlug || ""}`;

  return (
    <div className="spa-viewport">
      <div key={transitionKey} className={`spa-screen ${animClass}`}>
        {renderCurrentView()}
      </div>
    </div>
  );
}
