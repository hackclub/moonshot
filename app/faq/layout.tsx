export default function FAQLayout({ children }: { children: React.ReactNode }) {
  // Standalone FAQ: never render Header; keep theme-reset for palette
  return <div className="theme-reset">{children}</div>;
}