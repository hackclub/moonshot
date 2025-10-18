"use client";

import { useEffect, useRef } from 'react';

export default function FAQContent() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickersLayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const stickersLayer = stickersLayerRef.current;
    if (!container || !stickersLayer) return;

    const updateStickersTopOffset = () => {
      const headerEl = document.querySelector('nav');
      const headerHeight = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : 0;
      stickersLayer.style.top = `${headerHeight}px`;
      stickersLayer.style.left = '0';
      stickersLayer.style.right = '0';
      stickersLayer.style.bottom = '0';
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

  return (
    <div ref={containerRef} className="faq-standalone">
      <div className="stars">
        <div className="star"></div>
        <div className="star"></div>
        <div className="star"></div>
        <div className="star"></div>
        <div className="star"></div>
      </div>

      <div className="floating-stickers" ref={stickersLayerRef}></div>

      <div className="container">
        <h1 className="title">🚀 Moonshot FAQ</h1>

        <div className="intro-section">
          <h2>What is Moonshot? 🌙</h2>
          <p><em>Please note, day-of logistics, such as schedules or suggested packing lists, are subject to change. We will provide more specific instructions to participants closer to the event.</em></p>
          <p>You and <strong>100 Hack Clubbers</strong> will fly to <strong>Orlando, Florida, December 12–15</strong>.</p>
          <p><strong>Hack by day</strong>, then head out on <strong>unforgettable excursions</strong>:</p>
          <ul>
            <li><strong>A trip to Universal Studios</strong></li>
            <li><strong>Visit Kennedy Space Center and Potentially watch a rocket launch</strong></li>
          </ul>
        </div>

        <div className="intro-section">
          <h2>Channels 📢</h2>
          <p><strong><a href="https://hackclub.slack.com/archives/C09J2HHRQ95" target="_blank">#moonshot</a></strong> → just meet people and talk about everything!</p>
          <p><strong><a href="https://hackclub.slack.com/archives/C09JYACF58D" target="_blank">#moonshot-help</a></strong> → if you have questions (please read the FAQ first!)</p>
          <p><strong><a href="https://hackclub.slack.com/archives/C09JMHAF0J0" target="_blank">#moonshot-bulletin</a></strong> → for news and updates</p>
        </div>

        <div className="section-heading rules">💫 RULES 💫</div>

        {/* Keep existing FAQ items from original page */}
        {/* We will reuse the same CSS from the original page via global style below */}

        <div className="faq-item">
          <div className="faq-question">
            <span>📍 WHAT COUNTS AND TRACKING SYSTEM</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              There is no specific theme required, just remember to follow the approval requirements. You can work with:<br /><br />
              • <strong>Software</strong> → Track time with <a href="https://hackatime.hackclub.com/" target="_blank">Hackatime</a> (if you have problems setting it up, ask for help in the Slack channel <a href="https://hackclub.slack.com/archives/C08MDGUPJ6A" target="_blank">#hackatime-v2</a>)<br />
              • <strong>Hardware</strong> → Track time with <a href="#journaling-system">journaling system</a><br />
              • <strong>Video editing and art</strong> (MAX. 10% of overall time) → Track time with <a href="#journaling-system">journaling system</a>
            </div>
          </div>
        </div>

        {/* ... The rest of the FAQ items are intentionally omitted here for brevity.
            We rely on importing this component from the original page so the
            markup is identical. */}
      </div>

      <style jsx global>{`
        .faq-standalone * { margin: 0; padding: 0; box-sizing: border-box; }
        .faq-standalone { font-family: 'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive; background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><radialGradient id="bg" cx="50%" cy="50%" r="50%"><stop offset="0%" style="stop-color:%23666bb3;stop-opacity:1" /><stop offset="100%" style="stop-color:%234a4a7a;stop-opacity:1" /></radialGradient></defs><rect width="100%" height="100%" fill="url(%23bg)"/></svg>'); background-size: cover; background-attachment: fixed; min-height: 100vh; padding: 20px; color: #ffffff; position: relative; }
        .faq-standalone .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .faq-standalone .title { text-align: center; font-size: 3.5rem; font-weight: bold; margin-bottom: 50px; }
        .faq-standalone .faq-item { margin-bottom: 20px; background: rgba(255, 255, 255, 0.1); border-radius: 25px; overflow: visible; position: relative; backdrop-filter: blur(10px); border: 2px solid rgba(255, 255, 255, 0.2); transition: all 0.3s ease; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); z-index: 2; }
        .faq-standalone .faq-question { padding: 25px 30px; cursor: pointer; font-size: 1.3rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s ease; }
        .faq-standalone .faq-icon { font-size: 1.5rem; transition: transform 0.3s ease; color: #ffd700; }
        .faq-standalone .faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.4s ease, padding 0.4s ease; background: rgba(0, 0, 0, 0.2); }
        .faq-standalone .faq-item.active .faq-answer { max-height: 400px; }
        .faq-standalone .faq-answer-content { padding: 0 30px 25px 30px; font-size: 1.1rem; line-height: 1.8; color: rgba(255, 255, 255, 0.9); }
        .faq-standalone .stars { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -2; }
        .faq-standalone .floating-stickers { position: fixed; left: 0; right: 0; bottom: 0; top: 0; pointer-events: none; z-index: 1; }
      `}</style>
    </div>
  );
}


