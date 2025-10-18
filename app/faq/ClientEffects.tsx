"use client";

import { useEffect } from 'react';

export default function ClientEffects() {
  useEffect(() => {
    const container = document.getElementById('faq-container');
    const stickersLayer = document.getElementById('faq-stickers');
    if (!container || !stickersLayer) return;

    const updateStickersTopOffset = () => {
      const headerEl = document.querySelector('nav');
      const headerHeight = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : 0;
      (stickersLayer as HTMLDivElement).style.top = `${headerHeight}px`;
      (stickersLayer as HTMLDivElement).style.left = '0';
      (stickersLayer as HTMLDivElement).style.right = '0';
      (stickersLayer as HTMLDivElement).style.bottom = '0';
    };
    updateStickersTopOffset();
    window.addEventListener('resize', updateStickersTopOffset);

    const faqItems = Array.from(container.querySelectorAll('.faq-item')) as HTMLElement[];

    const images = [
      { src: '/img/sticker-astronaut.png', size: 90 },
      { src: '/img/sticker-rocket.png', size: 110 },
      { src: '/img/sticker-cat.png', size: 95 }
    ];
    const count = 9;

    function rand(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const createdImages: HTMLImageElement[] = [];
    for (let i = 0; i < count; i++) {
      const cfg = images[i % images.length];
      const img = document.createElement('img');
      img.src = cfg.src;
      img.alt = 'floating sticker';
      img.className = 'floating-sticker';
      img.style.width = cfg.size + 'px';
      img.style.top = rand(0, 85) + 'vh';
      img.style.left = rand(0, 85) + 'vw';
      const bob = rand(5, 10).toFixed(2) + 's';
      const sway = rand(6, 11).toFixed(2) + 's';
      const spin = rand(8, 14).toFixed(2) + 's';
      const delay = rand(0, 4).toFixed(2) + 's';
      img.style.animationDuration = bob + ', ' + sway + ', ' + spin;
      img.style.animationDelay = delay + ', ' + delay + ', ' + delay;
      img.addEventListener('error', () => {
        if (img.parentElement) img.parentElement.removeChild(img);
        // eslint-disable-next-line no-console
        console.warn('Sticker image failed to load:', img.src);
      });
      stickersLayer.appendChild(img);
      createdImages.push(img);
    }

    const clickHandlers: Array<() => void> = [];
    faqItems.forEach((item) => {
      const question = item.querySelector('.faq-question');
      if (!question) return;
      const handler = () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach((other) => other.classList.remove('active'));
        if (!isActive) item.classList.add('active');
      };
      question.addEventListener('click', handler);
      clickHandlers.push(() => question.removeEventListener('click', handler));
    });

    return () => {
      createdImages.forEach((img) => stickersLayer.removeChild(img));
      clickHandlers.forEach((off) => off());
      window.removeEventListener('resize', updateStickersTopOffset);
    };
  }, []);

  return null;
}


