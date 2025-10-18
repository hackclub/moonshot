"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./badge.module.css";

// Variables for easy swapping
const PUBLIC_CANONICAL = process.env.CANONICAL_HOST;

function normalizeBaseFromHost(host: string): string {
  const hasProtocol = host.startsWith('http://') || host.startsWith('https://');
  if (hasProtocol) return host;
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (isLocal) {
    const hasPort = host.includes(':');
    return `http://${hasPort ? host : `${host}:3000`}`;
  }
  return `https://${host}`;
}

const TARGET_LINK = (() => {
  if (PUBLIC_CANONICAL && PUBLIC_CANONICAL.trim().length > 0) {
    return normalizeBaseFromHost(PUBLIC_CANONICAL.trim());
  }
  if (typeof window !== 'undefined') {
    return normalizeBaseFromHost(window.location.host);
  }
  return 'http://localhost:3000';
})();
const BADGE_IMAGE_URL = "https://hc-cdn.hel1.your-objectstorage.com/s/v3/35ad2be8c916670f3e1ac63c1df04d76a4b337d1_moonshot.png";

export default function BadgeGenerator() {
  const { status } = useSession();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // Redirect to login if not authenticated
  if (status === "unauthenticated") {
    router.push("/launchpad/login");
    return null;
  }

  // Show loading while session is loading
  if (status === "loading") {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const badgeCode = `<div align="center">
  <a href="${TARGET_LINK}" target="_blank">
    <img src="${BADGE_IMAGE_URL}" 
         alt="This project is part of Moonshot, a 4-day hackathon in Florida visiting Kennedy Space Center and Universal Studios!" 
         style="width: 100%;">
  </a>
</div>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(badgeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.progressSection}>
          <h2 className={styles.title}>
            Moonshot Badge
          </h2>
          <div className={styles.badgeSection}>
            <p className={styles.description}>
              Copy the badge below to add to your project&apos;s README!
            </p>
            <p className={styles.description} style={{ fontStyle: 'italic', fontSize: '0.95em', marginTop: '-1rem', marginBottom: '1.5rem' }}>
              You can put your badge anywhere in your readme and it will still count!
            </p>

            <div className={styles.preview}>
              <div
                className={styles.previewContent}
                dangerouslySetInnerHTML={{ __html: badgeCode }}
              />
            </div>

            <div className={styles.codeBlock}>
              <pre className={styles.code}>{badgeCode}</pre>
              <button onClick={handleCopy} className={styles.copyButton}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
