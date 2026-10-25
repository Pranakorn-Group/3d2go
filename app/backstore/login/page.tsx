import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { FadeIn } from "@/components/motion";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") redirect("/backstore");

  return (
    <main className="flex min-h-svh items-center justify-center bg-gradient-to-b from-accent/60 to-background p-4">
      <FadeIn className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <LoginForm />
      </FadeIn>
    </main>
  );
}
