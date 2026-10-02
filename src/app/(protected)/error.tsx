"use client";
import { PageError } from "@/components/ui/page-error";
export default function ErrorBoundary({ retry }: { error: Error & { digest?: string }; retry: () => void }) { return <PageError retry={retry} />; }
