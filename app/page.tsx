"use client";
import { useState, useEffect } from "react";
import Form from "@/app/rsvp/form";
import SignupProgress from "@/components/common/SignupProgress";
import LoadingModal from "@/components/common/LoadingModal";
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { PrefillData } from "@/types/prefill";
import Image from "next/image";
import Floating from "@/components/common/Floating";
import Star from "@/components/common/Star";

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

// Extract the search params logic to a separate client component
function SearchParamsHandler({ children }: { children: (prefillData: PrefillData) => React.ReactNode }) {
  const searchParams = useSearchParams();
  const [prefillData, setPrefillData] = useState<PrefillData>({});

  useEffect(() => {
    const firstName = searchParams.get('first')?.trim().replace(/[^A-Za-z0-9-]/g, '');
    const lastName = searchParams.get('last')?.trim().replace(/[^A-Za-z0-9-]/g, '');
    const email = searchParams.get('email')?.trim().replace(/[^A-Za-z0-9-@.]/g, '');
    const birthdayISO = searchParams.get('birthday')?.trim().replace(/[^A-Za-z0-9-:T]/g, '');

    const formattedBirthday = birthdayISO ? birthdayISO.split('T')[0] : null;

    setPrefillData({
      firstName: firstName,
      lastName: lastName,
      email: email,
      birthday: formattedBirthday,
    });
    console.log("Prefill Data from URL:", { firstName, lastName, email, birthday: formattedBirthday });
  }, [searchParams]);

  return <>{children(prefillData)}</>;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [scrollPercent, setScrollPercent] = useState(0);
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const [activeView, setActiveView] = useState<'hero' | 'rsvp'>('hero');
  const stars = Array(50).fill(null);
  const percentage = 50

  const handleLoadComplete = () => {
    setIsLoading(false);
  };

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

  const bannerOpacity = Math.max(0, Math.min(1, (0.75 - scrollPercent) / 0.1));

  const imageUrls = [
    "/logo.svg",
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
      <main className="min-h-screen bg-[#130B2C] text-sand">
        {bannerOpacity > 0 && (
          <Link href="https://hackclub.com">
            <img
              style={{
                position: "absolute",
                top: "20px",
                left: "0",
                border: "0",
                width: "180px",
                zIndex: "999",
                opacity: bannerOpacity,
                transition: "opacity 0.2s ease-out"
              }}
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
        {activeView === 'hero' ? (
          <div
            className="relative w-screen flex items-center justify-center overflow-hidden min-h-[100svh] min-h-[100dvh] md:h-screen"
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
            className="pointer-events-none select-none absolute left-1/2 -translate-x-1/2 top-[80px] w-[80vw] max-w-[900px] h-auto z-50"
          />
          {/* Moon (moonpheus) behind top-right clouds */}
          <Image
            src="/moonpheus-nosticker.webp"
            alt="Moon"
            width={400}
            height={400}
            priority
            sizes="25vw"
            className="pointer-events-none select-none absolute top-6 right-[12vw] w-[105px] md:w-[150px] h-auto z-0 opacity-90"
          />
          
          {/* Top-right clouds overlay */}
          <Image
            src="/topright-cloud.webp"
            alt=""
            width={1200}
            height={800}
            priority
            sizes="50vw"
            className="pointer-events-none select-none absolute top-0 right-0 max-w-[65vw] md:max-w-[50vw] w-auto h-auto z-10 opacity-90"
          />
          {/* Simple bottom clouds: no scaling, raw images anchored to bottom */}
          <Image
            src="/bottom-clouds.webp"
            alt=""
            width={1600}
            height={800}
            priority
            sizes="200vw"
            className="pointer-events-none select-none absolute bottom-0 left-1/2 -translate-x-1/2 z-20 w-[220vw] md:w-[200vw] h-auto"
          />
          <Image
            src="/more-bottom-clouds.webp"
            alt=""
            width={1600}
            height={800}
            priority
            sizes="220vw"
            className="pointer-events-none select-none absolute -bottom-6 left-1/2 -translate-x-1/2 z-30 w-[240vw] md:w-[220vw] h-auto"
          />
          {/* Decorative astronauts with gentle wiggle */}
          <Image
            src="/cat-stronaut.webp"
            alt="Cat-stronaut"
            width={200}
            height={200}
            priority
            sizes="20vw"
            className="pointer-events-none select-none absolute top-28 md:top-32 left-6 w-[180px] md:w-[270px] h-auto z-30 wiggle-slow"
          />
          <Image
            src="/orph.webp"
            alt="Orph astronaut"
            width={220}
            height={220}
            priority
            sizes="20vw"
            className="pointer-events-none select-none absolute bottom-[12vh] right-6 w-[202px] md:w-[294px] h-auto z-30 wiggle-slow"
          />
          
          <p className="font-quintessential absolute left-1/2 -translate-x-1/2 bottom-[5%] md:bottom-[10%] w-11/12 md:w-auto max-w-xl text-center text-xl md:text-2xl text-black">
            
          </p>
          <button
            type="button"
            onClick={() => setActiveView('rsvp')}
            className="absolute z-40 left-1/2 -translate-x-1/2 bottom-[6%] md:bottom-[10%] animate-bounce hover:[animation-play-state:paused] focus:[animation-play-state:paused] transition-opacity duration-200 ease-out hover:opacity-70 active:opacity-60"
          >
            <Image
              src="/rsvp.webp"
              alt="RSVP now"
              width={300}
              height={120}
              priority
              className="w-56 md:w-72 h-auto drop-shadow-lg select-none"
            />
          </button>
        </div>
        ) : (
        <div id="rsvp" className="font-quintessential relative flex min-h-[100svh] min-h-[100dvh] md:min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-[#150340] to-black pt-16 md:pt-0">
          {stars.map((star, i) => (
            <Star key={i} />
          ))}
          <Floating seed={Math.random()}>
            <Image
              src="/character.webp"
              width={500}
              height={500}
              alt="Character"
              className="w-60 h-auto"
            />
          </Floating>
          <Floating seed={Math.random()}>
            <Image
              src="/orph.webp"
              width={500}
              height={500}
              alt="Astro Orpheus"
              className="w-60 h-auto"
            />
          </Floating>

        <SearchParamsHandler>
          {(prefillData) => (
            <>
                  <SignupProgress />
                  <Form hasSession={false} prefillData={prefillData || {}} />
            </>
          )}
        </SearchParamsHandler>
        </div>
        )}

        <div id="rsvp" className="font-quintessential relative flex min-h-[100svh] min-h-[100dvh] md:min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-[#150340] to-black pt-16 md:pt-0">
          {stars.map((star, i) => (
            <Star key={i} />
          ))}
          <Floating seed={Math.random()}>
            <Image
              src="/character.webp"
              width={500}
              height={500}
              alt="Character"
              className="w-60 h-auto"
            />
          </Floating>
          <Floating seed={Math.random()}>
            <Image
              src="/orph.webp"
              width={500}
              height={500}
              alt="Astro Orpheus"
              className="w-60 h-auto"
            />
          </Floating>

        <SearchParamsHandler>
          {(prefillData) => (
            <>
                  <SignupProgress />
                  <Form hasSession={false} prefillData={prefillData || {}} />
            </>
          )}
        </SearchParamsHandler>
        </div>

      </main>
      <style jsx global>{`
        @keyframes slow-wiggle {
          0% { transform: rotate(-2deg) translateY(0); }
          50% { transform: rotate(2deg) translateY(4px); }
          100% { transform: rotate(-2deg) translateY(0); }
        }
        .wiggle-slow { animation: slow-wiggle 7s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
