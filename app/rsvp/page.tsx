"use client";
import { useState, useEffect, Suspense } from "react";
import Form from "@/app/rsvp/form";
import SignupProgress from "@/components/common/SignupProgress";
import LoadingModal from "@/components/common/LoadingModal";
import { useSearchParams } from 'next/navigation';
import { PrefillData } from "@/types/prefill";
import Image from "next/image";
import Floating from "@/components/common/Floating";
import Star from "@/components/common/Star";
import Link from "next/link";

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

export default function RSVPPage() {
  const [isLoading, setIsLoading] = useState(true);
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const stars = Array(50).fill(null);

  const handleLoadComplete = () => {
    setIsLoading(false);
  };


  const imageUrls = [
    "/star-tile.png",
    "/character.webp",
    "/orph.webp",
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
    <div className="theme-reset">
      <main className="font-quintessential relative flex min-h-[100svh] w-full overflow-hidden flex-col items-center justify-center bg-gradient-to-br from-[#150340] to-black pt-2 md:pt-0" style={{ fontFamily: 'var(--font-kavoon), Kavoon, cursive' }}>
        {/* FAQ button */}
        <Link
          href="/faq"
          className="fixed top-4 right-4 z-[200] font-luckiest uppercase tracking-wide text-white bg-black/70 hover:bg-black/80 transition px-4 py-2 rounded-lg border-2 border-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-2 ring-black/30"
        >
          FAQ
        </Link>

        {/* Back to home button */}
        <Link
          href="/"
          className="fixed top-4 left-4 z-[200] font-luckiest uppercase tracking-wide text-white bg-black/70 hover:bg-black/80 transition px-4 py-2 rounded-lg border-2 border-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-2 ring-black/30"
        >
          ← HOME
        </Link>

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
              fontFamily: "var(--font-kavoon)"
            }}
          >
            LOCAL
          </div>
        )}

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

        <Suspense fallback={<div>Loading...</div>}>
          <SearchParamsHandler>
            {(prefillData) => (
              <>
                <SignupProgress />
                <Form hasSession={false} prefillData={prefillData || {}} />
              </>
            )}
          </SearchParamsHandler>
        </Suspense>

      </main>
      <style jsx global>{`
        .font-luckiest { font-family: var(--font-kavoon), 'Kavoon', cursive !important; }
        
      `}</style>
    </div>
  );
}

