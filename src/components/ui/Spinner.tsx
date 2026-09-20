export function Spinner({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      role="progressbar"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-accent border-t-transparent ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <Spinner size={32} />
    </div>
  );
}
