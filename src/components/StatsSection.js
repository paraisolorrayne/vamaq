'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './StatsSection.module.css';

const STATS = [
  { value: 13, suffix: '+', label: 'Anos de mercado', prefix: '' },
  { value: 500, suffix: '+', label: 'Veículos negociados', prefix: '' },
  { value: 100, suffix: '%', label: 'Procedência verificada', prefix: '' },
  { value: 4.9, suffix: '', label: 'Avaliação dos clientes', prefix: '\u2605 ', decimals: 1 },
];

function useCountUp(target, isVisible, duration = 1500, decimals = 0) {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isVisible || hasAnimated.current) return;
    hasAnimated.current = true;

    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;

      setCount(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.round(current));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [isVisible, target, duration, decimals]);

  return count;
}

function StatItem({ stat, isVisible }) {
  const count = useCountUp(stat.value, isVisible, 1500, stat.decimals || 0);

  const display = stat.decimals
    ? count.toFixed(stat.decimals)
    : count;

  return (
    <div className={styles.stat}>
      <span className={styles.number} aria-label={`${stat.prefix}${stat.value}${stat.suffix} ${stat.label}`}>
        {stat.prefix}
        {display}
        <span className={styles.suffix}>{stat.suffix}</span>
      </span>
      <span className={styles.label}>{stat.label}</span>
    </div>
  );
}

export default function StatsSection() {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={styles.section} ref={sectionRef} aria-label="Nossos números">
      <div className={styles.container}>
        <div className={styles.grid}>
          {STATS.map((stat) => (
            <StatItem key={stat.label} stat={stat} isVisible={isVisible} />
          ))}
        </div>
      </div>
    </section>
  );
}
