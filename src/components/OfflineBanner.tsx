// A small fixed banner that only appears at all when there's
// actually something queued — visible from anywhere in the app,
// since offline submissions can happen on any page and someone
// should be able to see "this hasn't actually sent yet" no matter
// where they navigate to next.

interface OfflineBannerProps {
  pendingCount: number;
}

export function OfflineBanner({ pendingCount }: OfflineBannerProps) {
  if (pendingCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[2000] bg-signal-orange px-4 py-2 text-center text-sm font-medium text-white">
      {pendingCount} {pendingCount === 1 ? 'request' : 'requests'} saved offline — will send automatically once you're
      back online.
    </div>
  );
}
