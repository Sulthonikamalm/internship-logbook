import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/features/auth/components/login-form";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Masuk — InternFlow",
  description: "Masuk ke InternFlow untuk mengelola logbook magang Anda.",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // If already authenticated, redirect to dashboard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const nextUrl = params.next;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-background to-blue-50/50 px-4 py-8">
      {/* Decorative background elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Login card */}
      <div className="relative w-full max-w-[420px] space-y-8">
        {/* Logo and heading */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 mx-auto">
            <BookOpen className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Masuk ke InternFlow
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Logbook magang digital Anda
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-7 shadow-xl shadow-black/5">
          <LoginForm nextUrl={nextUrl} />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} InternFlow. Sistem Logbook Magang.
        </p>
      </div>
    </div>
  );
}
