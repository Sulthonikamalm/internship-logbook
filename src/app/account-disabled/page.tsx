import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldOff, LogOut } from "lucide-react";

export const metadata: Metadata = {
  title: "Akun Dinonaktifkan — InternFlow",
  description: "Akun Anda telah dinonaktifkan.",
};

export default async function AccountDisabledPage() {
  // Check if user is actually authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50/50 via-background to-red-50/30 px-4">
      <Card className="max-w-md w-full shadow-xl border-destructive/20">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 mx-auto">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">
              Akun Dinonaktifkan
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Akun Anda telah dinonaktifkan oleh administrator.
              Hubungi administrator program magang Anda untuk informasi lebih lanjut.
            </p>
          </div>

          <form action={async () => {
            "use server";
            const { logoutAction } = await import("@/features/auth/actions/logout");
            await logoutAction();
          }}>
            <Button
              id="disabled-logout"
              type="submit"
              variant="outline"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
