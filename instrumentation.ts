// Runs once when the Node.js server starts (Next.js instrumentation hook).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startDataSync } = await import('./lib/dataSync');
  startDataSync();
  // Without DATA_URL (local dev), still warm the home page caches.
  if (!process.env.DATA_URL) {
    const { getHomeData } = await import('./lib/home');
    setTimeout(() => {
      try {
        getHomeData();
      } catch {}
    }, 1000).unref();
  }
}
