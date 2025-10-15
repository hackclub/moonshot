"use client";

import { useEffect, useRef } from 'react';

export default function FAQ() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickersLayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const stickersLayer = stickersLayerRef.current;
    if (!container || !stickersLayer) return;

    const faqItems = Array.from(container.querySelectorAll('.faq-item')) as HTMLElement[];

    // Floating stickers setup
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
        // Hide any broken sticker if the file is missing
        if (img.parentElement) img.parentElement.removeChild(img);
        // eslint-disable-next-line no-console
        console.warn('Sticker image failed to load:', img.src);
      });
      stickersLayer.appendChild(img);
      createdImages.push(img);
    }

    // Accordion behavior
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
      // Cleanup stickers
      createdImages.forEach((img) => stickersLayer.removeChild(img));
      // Cleanup handlers
      clickHandlers.forEach((off) => off());
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

        <div className="faq-item" id="journaling-system">
          <div className="faq-question">
            <span>📍 JOURNALING SYSTEM</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              <em>(temporary method until the Launchpad release)</em><br /><br />
              • Take photos/screenshots of your improvements<br />
              • Record quick update videos<br />
              • Write a brief description of the changes<br /><br />
              Please do this for each new feature (ideally around every hour of work), put everything in your Github commits.
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>📍 APPROVAL REQUIREMENTS</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              • 75+ hours correctly tracked<br />
              • Github opensource repository, with frequent and detailed commits (for each new feature, ideally around every 30min-1h of work)<br />
              • No fraud, double-dipping or other broken rules
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>📍 RULES</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              ✅ AI (only as support)<br />
              ❌ Double-dipping with other programs<br />
              ❌ FRAUD<br /><br />
              <em className="warning">Don't cheat the time tracking system. No bots, no fake key presses, no UI manipulation. If you do, you'll be banned from Hackatime and other participating YSWS / events / programs</em>
            </div>
          </div>
        </div>

        <div className="section-heading faq">❓ FAQ SECTION ❓</div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Is airfare covered as part of the 75 hours I need to work to attend?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              No. Travel stipends will be available within the Moonshop at a minimum rate of $10/hr. Your airfare must be covered by yourself personally, or alternatively thru earning stipends.
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>How do I get invited?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Log your hours, work on your project for 75 hours and ship it on Launchpad
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Who Can Participate?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Anyone between the ages of 13 and 18 (included) can participate in Moonshot!
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>What if I complete Launchpad but can't attend Moonshot?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              You will be able to redeem the hours you spent making projects in a shop for fun, neat prizes!
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Is Participation Free?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Yes! Participation is entirely free, but only if you complete Launchpad. Without shipping your projects on Launchpad, you won't be able to join Moonshot.
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>How Do I Register?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              <a href="https://moonshot.hackclub.com/" target="_blank" rel="noopener noreferrer">Signup here</a>!
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Can I start?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Yes, track your hours with Hackatime or use the journaling system
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Is the flight stipend covered?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              You can redeem your flight stipend in the Moonshop using your hours (coming soon...)
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Can I collab with my friends and make a single project?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Yes BUT:<br />
              1. You can work on the same repo but in different forks<br />
              2. your hours will be obv counted separately
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Can I ship a private (or partially private) project?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              No, your project MUST be open source, otherwise hours will not be counted.
            </div>
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">
            <span>Can I work in already started projects?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              It's fine if you work on a project that has been associated w/ another program or already started - you can continue it - but we will only take hours from the beginning of the moonshot announcement. We HIGHLY suggest to create a new Github repository, it's not mandatory, but it will increase your chances of being approved, and will make the process much faster.
            </div>
          </div>
        </div>

        <div className="faq-item contact">
          <div className="faq-question">
            <span>📍 STILL HAVE QUESTIONS?</span>
            <span className="faq-icon">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-content">
              Ask directly in the HC Slack channel <strong><a href="https://hackclub.slack.com/archives/C09JYACF58D" target="_blank">#moonshot-help</a></strong> or email <strong>moonshot@hackclub.com</strong>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .faq-standalone * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        .faq-standalone {
          font-family: 'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive;
          background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><radialGradient id="bg" cx="50%" cy="50%" r="50%"><stop offset="0%" style="stop-color:%23666bb3;stop-opacity:1" /><stop offset="100%" style="stop-color:%234a4a7a;stop-opacity:1" /></radialGradient></defs><rect width="100%" height="100%" fill="url(%23bg)"/><circle cx="200" cy="150" r="8" fill="%237a7ab8" opacity="0.8"/><circle cx="300" cy="200" r="6" fill="%238a8ac8" opacity="0.7"/><circle cx="150" cy="300" r="7" fill="%236a6aa8" opacity="0.6"/><circle cx="400" cy="100" r="5" fill="%239a9ad8" opacity="0.5"/><circle cx="500" cy="250" r="9" fill="%235a5a98" opacity="0.7"/><circle cx="600" cy="180" r="6" fill="%238a8ac8" opacity="0.6"/><circle cx="700" cy="320" r="8" fill="%237a7ab8" opacity="0.8"/><circle cx="800" cy="150" r="7" fill="%236a6aa8" opacity="0.5"/><circle cx="900" cy="280" r="5" fill="%239a9ad8" opacity="0.7"/><circle cx="1000" cy="200" r="6" fill="%235a5a98" opacity="0.6"/><circle cx="1100" cy="350" r="8" fill="%237a7ab8" opacity="0.8"/></svg>');
          background-size: cover;
          background-attachment: fixed;
          min-height: 100vh;
          padding: 20px;
          color: #ffffff;
          position: relative;
        }
        .faq-standalone .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .faq-standalone .title {
          text-align: center;
          font-size: 3.5rem;
          font-weight: bold;
          margin-bottom: 50px;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
          animation: glow 2s ease-in-out infinite alternate;
          background: linear-gradient(45deg, #ffd700, #ffed4e, #ffd700);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        @keyframes glow {
          from { text-shadow: 0 0 20px rgba(255, 255, 255, 0.5); }
          to { text-shadow: 0 0 30px rgba(255, 255, 255, 0.8), 0 0 40px rgba(255, 215, 0, 0.3); }
        }
        .faq-standalone .faq-item {
          margin-bottom: 20px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 25px;
          overflow: visible;
          position: relative;
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          z-index: 1;
        }
        .faq-standalone .faq-item:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.2);
          border-color: rgba(255, 215, 0, 0.5);
        }
        .faq-standalone .faq-question {
          padding: 25px 30px;
          cursor: pointer;
          font-size: 1.3rem;
          font-weight: 600;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s ease;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
        }
        .faq-standalone .faq-question:hover {
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 255, 255, 0.1));
        }
        .faq-standalone .faq-icon {
          font-size: 1.5rem;
          transition: transform 0.3s ease;
          color: #ffd700;
        }
        .faq-standalone .faq-item.active .faq-icon {
          transform: rotate(45deg);
        }
        .faq-standalone .faq-answer {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.4s ease, padding 0.4s ease;
          background: rgba(0, 0, 0, 0.2);
        }
        .faq-standalone .faq-item.active .faq-answer {
          max-height: 400px;
        }
        .faq-standalone .faq-answer-content {
          padding: 0 30px 25px 30px;
          font-size: 1.1rem;
          line-height: 1.8;
          color: rgba(255, 255, 255, 0.9);
        }
        .faq-standalone .intro-section {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 25px;
          padding: 30px;
          margin-bottom: 30px;
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .faq-standalone .intro-section h2 {
          font-size: 2rem;
          margin-bottom: 20px;
          color: #ffd700;
          text-align: center;
        }
        .faq-standalone .intro-section p {
          font-size: 1.2rem;
          line-height: 1.8;
          margin-bottom: 15px;
        }
        .faq-standalone .intro-section ul {
          font-size: 1.1rem;
          line-height: 1.8;
          padding-left: 20px;
        }
        .faq-standalone .intro-section em {
          background: linear-gradient(135deg, #ffb3ba, #ffdfba);
          color: #8b4513;
          padding: 8px 12px;
          border-radius: 15px;
          font-style: italic;
          display: inline-block;
          border: 2px solid #ff9aa2;
        }
        .faq-standalone .intro-section strong { color: #d2c8fc; }
        .faq-standalone .intro-section a {
          color: #b8d4f0;
          text-decoration: none;
          border-bottom: 1px solid #b8d4f0;
          transition: all 0.3s ease;
        }
        .faq-standalone .intro-section a:hover {
          color: #9bc4e2;
          border-bottom-color: #9bc4e2;
          text-shadow: 0 0 8px rgba(155, 196, 226, 0.5);
        }
        .faq-standalone .faq-answer-content strong { color: #d2c8fc; }
        .faq-standalone .faq-answer-content em { color: #d2691e; font-style: italic; }
        .faq-standalone .faq-answer-content em.warning { color: #ff6b6b; font-style: italic; }
        .faq-standalone .faq-item.contact { background: rgba(255, 182, 193, 0.2); border: 2px solid rgba(255, 182, 193, 0.4); }
        .faq-standalone .faq-item.contact:hover { border-color: rgba(255, 182, 193, 0.7); background: rgba(255, 182, 193, 0.25); }
        .faq-standalone .faq-item.contact .faq-question { background: linear-gradient(135deg, rgba(255, 182, 193, 0.3), rgba(255, 182, 193, 0.1)); }
        .faq-standalone .faq-item.contact .faq-question:hover { background: linear-gradient(135deg, rgba(255, 182, 193, 0.4), rgba(255, 182, 193, 0.2)); }
        .faq-standalone .faq-answer-content a { color: #ffd700; text-decoration: none; border-bottom: 1px solid #ffd700; transition: all 0.3s ease; }
        .faq-standalone .faq-answer-content a:hover { color: #ffed4e; border-bottom-color: #ffed4e; text-shadow: 0 0 8px rgba(255, 215, 0, 0.5); }
        .faq-standalone .faq-answer-content a[href="#journaling-system"] { color: #98d8c8; border-bottom-color: #98d8c8; }
        .faq-standalone .faq-answer-content a[href="#journaling-system"]:hover { color: #7bc4b2; border-bottom-color: #7bc4b2; text-shadow: 0 0 8px rgba(123, 196, 178, 0.5); }
        .faq-standalone .section-heading { text-align: center; font-size: 2.5rem; font-weight: bold; margin: 40px 0 30px 0; padding: 20px; border-radius: 25px; text-shadow: 0 0 20px rgba(255, 255, 255, 0.5); animation: glow 2s ease-in-out infinite alternate; }
        .faq-standalone .section-heading.rules { background: linear-gradient(135deg, #ff6b6b, #ff8e8e); color: white; border: 3px solid #ff5252; }
        .faq-standalone .section-heading.faq { background: linear-gradient(135deg, #4ecdc4, #44a08d); color: white; border: 3px solid #26a69a; }
        .faq-standalone .stars { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -2; }
        .faq-standalone .floating-stickers { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .faq-standalone .floating-sticker { position: absolute; width: 96px; height: auto; opacity: 0.95; filter: drop-shadow(0 8px 14px rgba(0,0,0,0.35)); animation-name: bobY, swayX, spinSlight; animation-iteration-count: infinite, infinite, infinite; animation-timing-function: ease-in-out, ease-in-out, linear; }
        @keyframes bobY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
        @keyframes swayX { 0%,100% { margin-left: 0; } 50% { margin-left: 12px; } }
        @keyframes spinSlight { 0% { rotate: -4deg; } 50% { rotate: 4deg; } 100% { rotate: -4deg; } }
        .faq-standalone .star { position: absolute; background: #ffd700; border-radius: 50%; animation: twinkle 3s infinite; }
        .faq-standalone .star:nth-child(1) { top: 10%; left: 10%; width: 4px; height: 4px; animation-delay: 0s; }
        .faq-standalone .star:nth-child(2) { top: 20%; left: 80%; width: 3px; height: 3px; animation-delay: 0.5s; }
        .faq-standalone .star:nth-child(3) { top: 60%; left: 15%; width: 5px; height: 5px; animation-delay: 1s; }
        .faq-standalone .star:nth-child(4) { top: 80%; left: 70%; width: 3px; height: 3px; animation-delay: 1.5s; }
        .faq-standalone .star:nth-child(5) { top: 30%; left: 50%; width: 4px; height: 4px; animation-delay: 2s; }
        @keyframes twinkle { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
        @media (max-width: 768px) {
          .faq-standalone .title { font-size: 2.5rem; }
          .faq-standalone .faq-question { font-size: 1.1rem; padding: 20px 25px; }
          .faq-standalone .faq-answer-content { padding: 0 25px 20px 25px; font-size: 1rem; }
        }
      `}</style>
    </div>
  );
}