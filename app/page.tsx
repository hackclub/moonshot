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
        <div className="relative">
          <Image
            src="/background.png"
            alt="Background"
            className="h-screen w-screen"
            width={1268}
            height={951}
          ></Image>
          <p className="font-quintessential absolute bottom-[6%] left-[5%] max-w-sm text-center text-2xl text-black md:bottom-[10%] md:left-[23%] md:max-w-xl">
            Moonshot is lorem ipsum lorem ipsum lorem ipsum lorem ipsum lorem
            ipsum lorem ipsum lorem ipsum lorem ipsum
          </p>
          <a
            href="#rsvp"
            className="font-quintessential absolute top-[40%] left-[50%] z-30 flex animate-bounce flex-col items-center rounded-full bg-red-500 px-5 py-3 text-3xl text-white shadow-lg"
          >
            RSVP now!
          </a>
        </div>

        <div className="font-quintessential relative flex h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-[#150340] to-black">
          {stars.map((star, i) => (
            <Star key={i} />
          ))}
          <Floating seed={Math.random()}>
            <Image
              src="/character.png"
              width={500}
              height={500}
              alt="Character"
              className="h-60 w-60"
            />
          </Floating>
          <Floating seed={Math.random()}>
            <Image
              src="/orph.png"
              width={500}
              height={500}
              alt="Astro Orpheus"
              className="h-60 w-60"
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
    </div>
  );
}
