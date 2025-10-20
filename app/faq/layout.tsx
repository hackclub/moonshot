export default function FAQLayout({ children }: { children: React.ReactNode }) {
  // Standalone FAQ: never render Header; keep theme-reset for palette
  // Add top padding to avoid overlap from site-wide fixed header when embedded or linked
  return <div className="theme-reset" style={{ paddingTop: '4rem' }}>{children}</div>;
}