import Image from "next/image";

export function MarinaLoading({ label }: { label: string }) {
  return (
    <main className="relative isolate flex min-h-svh items-center justify-center gap-4 overflow-hidden bg-[#050b18] text-[rgba(245,247,251,0.72)]">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <Image
          src="/assets/main_bg.png"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-[#050b18]/20 to-[#050b18]/30" />
      </div>
      <span
        className="relative z-2 inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-[#f0d28a]"
        aria-hidden="true"
      />
      <p className="relative z-2 text-[14px]">{label}</p>
    </main>
  );
}
