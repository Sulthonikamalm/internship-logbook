import { AppShell } from "@/components/layout/app-shell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Database,
  ShieldCheck,
  Palette,
  Layers,
  Smartphone,
  Server,
  ArrowRight,
  Sparkles,
  Camera,
  FileSpreadsheet,
} from "lucide-react";

export default function HomePage() {
  const foundationChecklist = [
    {
      title: "Next.js 16 + App Router + React 19",
      description: "Turbopack-powered fullstack framework with server components and edge middleware.",
      status: "Ready",
      icon: Server,
    },
    {
      title: "TypeScript Strict Mode",
      description: "End-to-end type safety across domain models, server actions, and API boundaries.",
      status: "Configured",
      icon: CheckCircle2,
    },
    {
      title: "Tailwind CSS v4 & Blue/White Design System",
      description: "Tailored blue palette (#2563EB primary), slate neutral surfaces, and semantic tokens.",
      status: "Active",
      icon: Palette,
    },
    {
      title: "shadcn/ui Foundational Components",
      description: "Accessible, composable UI building blocks (Button, Card, Badge, Input, AppShell).",
      status: "Installed",
      icon: Layers,
    },
    {
      title: "Supabase SSR Client & Server Integration",
      description: "Browser client, async server client with cookie sync, admin client, and middleware.",
      status: "Connected",
      icon: Database,
    },
    {
      title: "Zod Environment Validation",
      description: "Runtime validation for client and server environment secrets with .env.example.",
      status: "Verified",
      icon: ShieldCheck,
    },
    {
      title: "Responsive Desktop Sidebar & Mobile Bottom Nav",
      description: "Mobile-first ergonomic design optimized for fast photo logging on smartphones.",
      status: "Live",
      icon: Smartphone,
    },
  ];

  const upcomingModules = [
    {
      name: "Phase 1: Auth & Database Security",
      desc: "Supabase Auth, profiles, Row Level Security (RLS), and user isolation boundaries.",
      badge: "Next Step",
      color: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      name: "Phase 2: Activity Core",
      desc: "Quick Activity mobile logger (<15 sec), autosave drafts, and optimistic locking.",
      badge: "Upcoming",
      color: "bg-slate-50 text-slate-700 border-slate-200",
    },
    {
      name: "Phase 3: Google Drive Evidence",
      desc: "Centralized photo evidence storage with IDOR protection and thumbnail pipelines.",
      badge: "Upcoming",
      color: "bg-slate-50 text-slate-700 border-slate-200",
    },
    {
      name: "Phase 4 & 5: Logbook & Excel Export",
      desc: "Comprehensive activity logbook with missing-day indicators and ExcelJS export.",
      badge: "Upcoming",
      color: "bg-slate-50 text-slate-700 border-slate-200",
    },
  ];

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <Badge variant="default" className="gap-1 px-3 py-1 font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                Phase 0 Foundation Complete
              </Badge>
              <Badge variant="success">Production Baseline</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              InternFlow Architecture Hub
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
              Sistem pencatatan aktivitas magang dan evidence berbasis Google Drive, Next.js, dan Supabase.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <a
                href="#checklist"
                className="text-sm font-medium"
              >
                Lihat Checklist
              </a>
            </Button>
            <Button className="shadow-md">
              <span>Siap ke Phase 1</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Foundation Checklist Grid */}
        <section id="checklist" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Phase 0 Checklist & System Verification
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Komponen fondasi yang telah diinisialisasi dan siap digunakan.
              </p>
            </div>
            <Badge variant="success" className="font-medium">
              7 / 7 Verified
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {foundationChecklist.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-lg bg-secondary text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="info" className="text-[11px]">
                        {item.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-bold mt-2">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <CardDescription className="text-xs leading-relaxed">
                      {item.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* System Architecture Pillars */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">
            Core Architecture Highlights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-primary/20 bg-blue-50/30">
              <CardHeader className="p-5">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Camera className="h-4 w-4" />
                  <span>Activity-Centric Model</span>
                </div>
                <CardTitle className="text-base mt-1">
                  Pencatatan Cepat & Mandiri
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-xs text-muted-foreground leading-relaxed">
                Activity adalah pusat sistem. User dapat mencatat dalam &lt;15 detik dari smartphone dengan foto, teks, atau keduanya tanpa mewajibkan Todo atau GitHub.
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="p-5">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Google Drive Centralized Storage</span>
                </div>
                <CardTitle className="text-base mt-1">
                  Database RLS + Private Evidence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-xs text-muted-foreground leading-relaxed">
                Supabase hanya menyimpan metadata dan relasi kepemilikan. Google Drive menyimpan binary foto asli secara tersentralisasi dengan otorisasi ketat anti-IDOR.
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="p-5">
                <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Excel Verification Engine</span>
                </div>
                <CardTitle className="text-base mt-1">
                  Export Logbook Siap Cetak
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-xs text-muted-foreground leading-relaxed">
                Ekspor otomatis logbook berbasis ExcelJS dengan tautan evidence terverifikasi, sheet terpisah, dan sanitasi formula untuk pembimbing magang.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Roadmap to Phase 1 and Beyond */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">
            Tahapan Roadmap Pengembangan
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {upcomingModules.map((module) => (
              <div
                key={module.name}
                className="flex items-start justify-between p-4 rounded-xl border border-border bg-card shadow-sm"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground">
                    {module.name}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    {module.desc}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${module.color}`}
                >
                  {module.badge}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
