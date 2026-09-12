"use client";

import { useEffect } from "react";

export default function HomeMotion() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const hero = document.querySelector("[data-home-hero]");
    const story = document.querySelector("[data-home-story]");
    if (!hero && !story) return;

    let frame = 0;

    const clamp = (n) => Math.min(1, Math.max(0, n));

    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;

      if (hero) {
        const rect = hero.getBoundingClientRect();
        const progress = clamp(Math.abs(rect.top) / Math.max(vh * 0.9, 1));
        hero.style.setProperty("--hero-progress", progress.toFixed(4));
      }

      if (story) {
        const rect = story.getBoundingClientRect();
        const progress = clamp((vh - rect.top) / Math.max(vh + rect.height * 0.45, 1));
        story.style.setProperty("--story-progress", progress.toFixed(4));
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return null;
}
