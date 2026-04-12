"use client";

interface RestrictedOverlayProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAuthenticate: () => void;
}

export function RestrictedOverlay({
  title,
  description,
  actionLabel = "Sign in",
  onAuthenticate,
}: RestrictedOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 sm:p-6">
      <h3 className="font-bold mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground mb-3.5 max-w-[320px] leading-relaxed">{description}</p>
      <button
        onClick={onAuthenticate}
        className="px-4 py-2 bg-primary/20 text-primary font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(0,208,156,0.2)] hover:shadow-[0_0_20px_rgba(0,208,156,0.3)] transition-all"
      >
        {actionLabel}
      </button>
    </div>
  );
}
