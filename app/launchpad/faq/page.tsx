"use client";

export default function LaunchpadFAQ() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'transparent' }}>
      <iframe
        src="/faq"
        title="Moonshot FAQ"
        className="w-full border-0"
        style={{ minHeight: 'calc(100vh - 64px)' }}
      />
    </div>
  );
}


