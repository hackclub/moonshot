"use client";

export default function LaunchpadFAQ() {
  return (
    <div className="min-h-screen starspace-bg" style={{ backgroundColor: 'transparent' }}>
      <iframe
        src="/faq"
        title="Moonshot FAQ"
        className="w-full border-0"
        style={{ minHeight: '100vh' }}
      />
    </div>
  );
}


