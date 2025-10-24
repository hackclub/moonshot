import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        <h1 className="text-5xl font-bold mb-4">404</h1>
        <p className="text-lg text-white/80 mb-6">
          The page you’re looking for has drifted into deep space.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/launchpad"
            className="px-4 py-2 rounded bg-white text-black font-medium hover:bg-white/90 transition-colors"
          >
            Back to Launchpad
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded border border-white/20 text-white hover:bg-white/10 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}


