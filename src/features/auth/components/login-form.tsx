"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, type LoginState } from "../actions/login";
import { Loader2, LogIn, Mail, Lock } from "lucide-react";

interface LoginFormProps {
  /** Optional next URL for redirect after login */
  nextUrl?: string;
}

export function LoginForm({ nextUrl }: LoginFormProps) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState<LoginState | null, FormData>(
    loginAction,
    null
  );

  // Redirect on successful login
  useEffect(() => {
    if (state?.success && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-5" id="login-form">
      {/* Hidden next URL for safe redirect */}
      {nextUrl && <input type="hidden" name="next" value={nextUrl} />}

      {/* Global error message */}
      {state?.error && (
        <div
          id="login-error"
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive flex items-start gap-2.5"
        >
          <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-destructive/15 flex items-center justify-center">
            <span className="text-xs font-bold">!</span>
          </div>
          <span>{state.error.message}</span>
        </div>
      )}

      {/* Email field */}
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-medium text-foreground flex items-center gap-1.5"
        >
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nama@email.com"
          required
          disabled={isPending}
          aria-invalid={state?.fieldErrors?.email ? "true" : undefined}
          aria-describedby={
            state?.fieldErrors?.email ? "email-error" : undefined
          }
          className="h-11"
        />
        {state?.fieldErrors?.email && (
          <p id="email-error" className="text-xs text-destructive mt-1">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      {/* Password field */}
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-sm font-medium text-foreground flex items-center gap-1.5"
        >
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          disabled={isPending}
          aria-invalid={state?.fieldErrors?.password ? "true" : undefined}
          aria-describedby={
            state?.fieldErrors?.password ? "password-error" : undefined
          }
          className="h-11"
        />
        {state?.fieldErrors?.password && (
          <p id="password-error" className="text-xs text-destructive mt-1">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      {/* Submit button */}
      <Button
        id="login-submit"
        type="submit"
        className="w-full h-11 text-base font-semibold"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Memproses...
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Masuk
          </>
        )}
      </Button>
    </form>
  );
}
