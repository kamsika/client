"use client"

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center">
      <div>
        <h1 className="text-2xl font-semibold">No Internet Connection</h1>
        <p className="mt-2 text-muted-foreground">
          Limited public content may be available, but live data and attendance require an internet connection.
        </p>
        <p className="mt-2 text-sm font-medium text-amber-700">
          You are offline. Connect to the internet to mark attendance.
        </p>
        <button className="mt-6 rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    </main>
  )
}
