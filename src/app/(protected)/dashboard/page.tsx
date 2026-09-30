import type { Metadata } from "next";
import type { AuthContext } from "@/lib/auth/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Clock, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard — InternFlow",
  description: "Ringkasan aktivitas magang Anda di InternFlow.",
};

interface DashboardPageProps {
  user?: AuthContext;
}

export default function DashboardPage({ user }: DashboardPageProps) {
  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Selamat datang{user ? `, ${user.displayName}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Ringkasan aktivitas magang Anda hari ini.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aktivitas
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">
              Aktivitas bulan ini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-success" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Jam Kerja
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0h</p>
            <p className="text-xs text-muted-foreground">
              Total jam bulan ini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-warning" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold capitalize">
              {user?.role ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Zona waktu: {user?.timezone ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for future content */}
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Konten aktivitas dan logbook akan tersedia di Phase berikutnya.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
