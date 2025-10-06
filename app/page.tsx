"use client";
import { useState, useEffect } from "react";
import LoadingModal from "@/components/common/LoadingModal";
import Link from "next/link";
import Image from "next/image";
import Modal from "@/components/common/Modal";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from 'next/navigation';

const loadingMessages = [
  "Fueling the rocket...",
  "Running preflight checks...",
  "Plotting a course to the Moon...",
  "Calibrating star trackers...",
  "Docking with the ISS...",
  "Counting down to liftoff...",
  "Aligning orbits...",
  "Cooling liquid oxygen tanks...",
  "Checking spacesuit seals...",
  "Deploying solar arrays...",
  "Queuing for Hogsmeade...",
  "Practicing Wingardium Leviosa...",
  "Sipping Butterbeer...",
  "Dodging Dementors on the Forbidden Journey...",
  "Polishing the Elder Wand...",
  "Wrangling mischievous Minions...",
  "Loading bananas for the Minions...",
  "Starting the Gringotts cart...",
  "Racing through Diagon Alley...",
  "Boarding the Hogwarts Express...",
];

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [scrollPercent, setScrollPercent] = useState(0);
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const [faqOpen, setFaqOpen] = useState(false);
  const [faqText, setFaqText] = useState<string>("");
  const percentage = 50
  const searchParams = useSearchParams();

  const handleLoadComplete = () => {
    setIsLoading(false);
  };

  // Build the RSVP link with query params preserved
  const rsvpLink = searchParams.toString() ? `/rsvp?${searchParams.toString()}` : '/rsvp';

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const effectiveScrollHeight = scrollHeight - clientHeight;
      setScrollPercent(effectiveScrollHeight > 0 ? scrollTop / effectiveScrollHeight : 0);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (faqOpen && !faqText) {
      fetch('/faq.md')
        .then((r) => r.text())
        .then(setFaqText)
        .catch(() => setFaqText('FAQ could not be loaded.'));
    }
  }, [faqOpen, faqText]);

  // Minimal markdown -> HTML for headings, lists, and paragraphs
  const markdownToHtml = (md: string): string => {
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const italic = (s: string) => s.replace(/\*(.*?)\*/g, '<em>$1</em>');
    const linkify = (s: string) =>
      s
        // Markdown-style links [text](url|mailto:)
        .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1<\/a>')
        // Plain URLs
        .replace(/(?<![\">])(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1<\/a>')
        // Plain emails
        .replace(/(?<![\w@.>])(\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b)/g, '<a href="mailto:$1">$1<\/a>');
    const lines = md.split(/\r?\n/);
    let html = '';
    let inList = false;
    let inSection = false;
    const flushList = () => { if (inList) { html += '</ul>'; inList = false; } };
    const openSection = () => { if (!inSection) { html += '<div class="faq-section">'; inSection = true; } };
    const closeSection = () => { flushList(); if (inSection) { html += '</div>'; inSection = false; } };
    for (let raw of lines) {
      const line = raw.replace(/\s+$/,'');
      if (/^\s*$/.test(line)) { flushList(); continue; }
      const h = line.match(/^(#{1,6})\s+(.+)/);
      if (h) {
        const level = h[1].length;
        const text = linkify(italic(esc(h[2])));
        if (level === 1) { // top heading
          closeSection();
          html += `<h2 class="faq-title">${text}</h2>`;
        } else if (level >= 3) { // treat ### as question headers
          closeSection();
          html += `<h3 class="faq-question">${text}</h3>`;
          openSection();
        } else {
          closeSection();
          html += `<h3>${text}</h3>`;
        }
        continue;
      }
      const li = line.match(/^[-*]\s+(.+)/);
      if (li) {
        openSection();
        if (!inList) { html += '<ul class="faq-list">'; inList = true; }
        html += `<li>${linkify(italic(esc(li[1])))}</li>`;
        continue;
      }
      openSection();
      const withBreaks = linkify(italic(esc(line))).replace(/\s\s$/,'<br/>');
      html += `<p class="faq-paragraph">${withBreaks}</p>`;
    }
    closeSection();
    return html;
  };

  const bannerOpacity = Math.max(0, Math.min(1, (0.75 - scrollPercent) / 0.1));

  const imageUrls = [
    "/logo.svg",
    "/star-tile.png",
    "/off-to-moonshot-overlay.webp",
    "/moonpheus-nosticker.webp",
    "/topright-cloud.webp",
    "/bottom-clouds.webp",
    "/roller-coaster.webp",
    "/more-bottom-clouds.webp",
    "/cat-stronaut.webp",
    "/orph.webp",
    "/character.webp",
    "https://assets.hackclub.com/banners/2025.svg",
  ];

  if (isLoading) {
    return (
      <LoadingModal
        titles={loadingMessages}
        imageUrls={imageUrls}
        onLoadComplete={handleLoadComplete}
      />
    );
  }

  return (
    <div>
      <main className="h-[100svh] overflow-hidden bg-[#130B2C] text-sand" style={{ fontFamily: 'var(--font-luckiest), cursive' }}>
        {/* Global FAQ button (visible on both hero and RSVP views) */}
        <button
          onClick={() => setFaqOpen(true)}
          className="fixed top-4 right-4 z-[200] font-luckiest uppercase tracking-wide text-white bg-black/70 hover:bg-black/80 transition px-4 py-2 rounded-lg border-2 border-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-2 ring-black/30"
        >
          FAQ
        </button>
        {bannerOpacity > 0 && (
          <Link href="https://hackclub.com">
            <img
              style={{
                position: "absolute",
                top: "20px",
                left: "0",
                border: "0",
                zIndex: "999",
                opacity: bannerOpacity,
                transition: "opacity 0.2s ease-out"
              }}
              className="hack-flag"
              src="https://assets.hackclub.com/banners/2025.svg"
              alt="Hack Club"
            />
          </Link>
        )}
        {isLocalEnv && (
          <div
            style={{
              position: "fixed",
              bottom: "20px",
              right: "20px",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              color: "white",
              padding: "8px 16px",
              borderRadius: "4px",
              fontSize: "14px",
              zIndex: "999",
              fontFamily: "var(--font-poppins)"
            }}
          >
            LOCAL
          </div>
        )}
        <div
            className="relative w-screen h-full flex items-center justify-center overflow-hidden"
            style={{
              backgroundImage: 'url("/star-tile.png")',
              backgroundRepeat: 'repeat',
              backgroundSize: '256px 256px',
              backgroundColor: '#130B2C'
            }}
          >
          {/* Title overlay */}
          <Image
            src="/off-to-moonshot-overlay.webp"
            alt="Off to Moonshot!"
            width={1200}
            height={400}
            priority
            sizes="80vw"
            className="pointer-events-none select-none absolute left-1/2 -translate-x-1/2 top-[80px] w-[80vw] max-w-[900px] h-auto z-50 hero-title"
          />
          {/* Moon (moonpheus) behind top-right clouds */}
          <Image
            src="/moonpheus-nosticker.webp"
            alt="Moon"
            width={400}
            height={400}
            priority
            sizes="25vw"
            className="pointer-events-none select-none absolute top-6 right-[12vw] w-[105px] md:w-[150px] xl:w-[220px] xl:right-[20vw] h-auto z-0 opacity-90 spin-slow"
          />
          
          {/* Top-right clouds overlay */}
          <Image
            src="/topright-cloud.webp"
            alt=""
            width={1200}
            height={800}
            priority
            sizes="50vw"
            className="pointer-events-none select-none absolute top-0 right-0 max-w-[75vw] md:max-w-[60vw] w-auto h-auto z-35 opacity-90 cloud-tr ultra-hide"
          />
          {/* Simple bottom clouds: no scaling, raw images anchored to bottom */}
          <Image
            src="/bottom-clouds.webp"
            alt=""
            width={1600}
            height={800}
            priority
            sizes="200vw"
            className="pointer-events-none select-none absolute bottom-0 left-1/2 -translate-x-1/2 z-20 w-[220vw] md:w-[200vw] h-auto opacity-50 cloud-back"
          />
          {/* Rollercoaster anchored to bottom, between back and front clouds */}
          <div className="pointer-events-none select-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[140vw] md:w-[120vw] max-w-[1400px]" style={{ zIndex: 25 }}>
            <Image
              src="/roller-coaster.webp"
              alt=""
              width={1600}
              height={800}
              priority
              sizes="1600px"
              className="w-full h-auto"
            />
          </div>
          <Image
            src="/more-bottom-clouds.webp"
            alt=""
            width={1600}
            height={800}
            priority
            sizes="220vw"
            className="pointer-events-none select-none absolute -bottom-6 left-1/2 -translate-x-1/2 z-30 w-[240vw] md:w-[220vw] h-auto opacity-50 cloud-front"
          />
          
          {/* Decorative astronauts with gentle wiggle */}
          <Image
            src="/cat-stronaut.webp"
            alt="Cat-stronaut"
            width={200}
            height={200}
            priority
            sizes="20vw"
            className="pointer-events-none select-none absolute top-28 md:top-32 xl:top-48 left-6 w-[180px] md:w-[270px] xl:w-[360px] h-auto z-40 wiggle-slow"
          />
          <Image
            src="/orph.webp"
            alt="Orph astronaut"
            width={220}
            height={220}
            priority
            sizes="20vw"
            className="pointer-events-none select-none absolute bottom-[12vh] md:bottom-[14vh] xl:bottom-[22vh] right-6 w-[202px] md:w-[294px] xl:w-[360px] h-auto z-40 wiggle-slow ultra-hide"
          />
          
          <p className="font-quintessential absolute left-1/2 -translate-x-1/2 bottom-[5%] md:bottom-[10%] w-11/12 md:w-auto max-w-xl text-center text-xl md:text-2xl text-black">
            
          </p>
          <Link
            href={rsvpLink}
            className="rsvp-btn fixed z-[100] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce hover:[animation-play-state:paused] focus:[animation-play-state:paused] font-luckiest tracking-wide uppercase transition-all duration-200 ease-out rounded-2xl border-2 border-white/60 bg-gradient-to-b from-[#0B0F1A] via-[#111827] to-[#0B1220] text-white px-6 py-3 md:px-10 md:py-4 text-2xl md:text-4xl shadow-[0_10px_0_rgba(0,0,0,0.4),0_0_20px_rgba(59,130,246,0.25)] hover:brightness-110 active:translate-y-0.5 inline-block"
          >
            RSVP NOW!
          </Link>

          {/* Bottom-center scrolling MOTD ticker */}
          <div className="pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-3 z-[95] bg-black/40 text-white rounded-full px-4 py-1 backdrop-blur-sm motd-container">
            <div className="motd-track overflow-hidden w-[41vw] max-w-[450px]">
              <div className="motd-ticker ticker-text inline-block whitespace-nowrap text-sm md:text-base tracking-wide font-luckiest">
                <span>
                  Come join us in Florida!  Visit NASA KSC and explore Universal Studios!  Teens only, you must be 13-18 to participate!  Totally free!!!
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* FAQ Modal */}
        <Modal isOpen={faqOpen} onClose={() => setFaqOpen(false)} title="FAQ" dark>
          <div className="prose max-w-none font-luckiest text-white">
            <div className="max-h-[70vh] overflow-y-auto px-2 faq-content">
              {faqText ? (
                <ReactMarkdown
                  components={{
                    a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-red-400 underline hover:text-red-300" />,
                    h1: ({node, ...props}) => <h2 {...props} className="faq-title" />,
                    h2: ({node, ...props}) => <h3 {...props} className="faq-title" />,
                    h3: ({node, ...props}) => <h3 {...props} className="faq-question" />,
                    ul: ({node, ...props}) => <ul {...props} className="faq-list" />,
                    p: ({node, ...props}) => <p {...props} className="faq-paragraph" />,
                  }}
                >
                  {faqText}
                </ReactMarkdown>
              ) : 'Loading...'}
            </div>
          </div>
        </Modal>

      </main>
      <style jsx global>{`
        @keyframes slow-wiggle {
          0% { transform: rotate(-2deg) translateY(0); }
          50% { transform: rotate(2deg) translateY(4px); }
          100% { transform: rotate(-2deg) translateY(0); }
        }
        .wiggle-slow { animation: slow-wiggle 7s ease-in-out infinite; }
        @keyframes spin-slow-kf { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-slow { animation: spin-slow-kf 60s linear infinite; transform-origin: center center; }
        .font-luckiest { font-family: var(--font-luckiest), 'Luckiest Guy', cursive !important; }
        .ticker-text, .ticker-text * { font-family: var(--font-luckiest), 'Luckiest Guy', cursive !important; }
        .ticker-text { letter-spacing: 0.02em; text-transform: uppercase; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        @keyframes motd-scroll-kf { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .motd-ticker { animation: motd-scroll-kf 20s linear infinite; }
        .motd-container { border: 1px solid rgba(255,255,255,0.15); }
        @keyframes wiggle-scale-kf {
          0% { transform: rotate(-4deg) scale(1); }
          50% { transform: rotate(4deg) scale(1.08); }
          100% { transform: rotate(-4deg) scale(1); }
        }
        .wiggle-scale { animation: wiggle-scale-kf 2.6s ease-in-out infinite; transform-origin: center; }
        .hack-flag { width: 180px; }
        @media (max-aspect-ratio: 16/9) { .hack-flag { width: 140px !important; } }
        @media (max-aspect-ratio: 4/3) { .hack-flag { width: 110px !important; } }
        @media (max-aspect-ratio: 1/1) { .hack-flag { width: 90px !important; } }
        @media (max-width: 480px) { .hack-flag { width: 90px !important; } }
        /* Landscape mobile: reduce an additional ~25% to avoid overlap */
        @media (orientation: landscape) and (max-height: 480px) {
          .hack-flag { width: 105px !important; }
        }
        
        .cloud-tr { transform: scale(0.67); transform-origin: top right; }
        /* Very wide viewports (>= 21:9): hide Orph and top-right cloud; adjust title/button */
        @media (min-aspect-ratio: 21/9) {
          .ultra-hide { display: none !important; }
          .hero-title { top: 24px !important; }
          .rsvp-btn { top: 62% !important; }
        }
        /* Very short landscape heights */
        @media (orientation: landscape) and (max-height: 400px) {
          .ultra-hide { display: none !important; }
          .hero-title { top: 16px !important; }
          .rsvp-btn { top: 64% !important; }
        }
        
        /* FAQ styling */
        .faq-title { font-size: 1.25rem; margin-bottom: 0.75rem; }
        .faq-question { font-size: 1.125rem; margin-top: 1rem; margin-bottom: 0.5rem; text-decoration: underline; }
        .faq-paragraph { margin: 0.25rem 0; }
        .faq-list { list-style: disc; margin-left: 1.25rem; margin-top: 0.25rem; margin-bottom: 0.5rem; }
        .faq-content a { color: #ef4444; text-decoration: underline; }

      `}</style>
    </div>
  );
}

