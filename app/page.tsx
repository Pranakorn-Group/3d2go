import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";

// Placeholder until the customer-facing store is built.
export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <FadeIn className="flex flex-col items-center gap-6">
        <Logo className="scale-125" />
        <p className="max-w-sm text-muted-foreground">Our filament store is coming soon.</p>
        <Button asChild variant="outline">
          <Link href="/backstore">Go to Backstore</Link>
        </Button>
      </FadeIn>
    </main>
  );
}
