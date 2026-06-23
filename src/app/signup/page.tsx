"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/workspace";

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createBrowserSupabaseClient();

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      // If email confirmation is disabled, a session is returned immediately.
      if (data.session) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }
      // Otherwise try an immediate sign-in (covers projects with confirmation off
      // but no session on signUp); fall back to a "check your email" notice.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }
      setNotice("Account created. Please check your email to confirm, then sign in.");
      setMode("signin");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <>
      <div className="mb-5 flex rounded-lg bg-gray-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => { setMode("signup"); setError(null); }}
          className={`flex-1 rounded-md px-3 py-1.5 ${mode === "signup" ? "bg-white text-sa-green shadow-sm" : "text-gray-600"}`}
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => { setMode("signin"); setError(null); }}
          className={`flex-1 rounded-md px-3 py-1.5 ${mode === "signin" ? "bg-white text-sa-green shadow-sm" : "text-gray-600"}`}
        >
          Sign in
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Your name</label>
            <input
              id="name" type="text" required value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sa-green focus:outline-none focus:ring-1 focus:ring-sa-green"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email" type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sa-green focus:outline-none focus:ring-1 focus:ring-sa-green"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
          <input
            id="password" type="password" required minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sa-green focus:outline-none focus:ring-1 focus:ring-sa-green"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}

        <Button type="submit" variant="primary" disabled={loading} className="w-full justify-center">
          {loading ? "Please wait…" : mode === "signup" ? "Create my free account" : "Sign in"}
        </Button>
      </form>
    </>
  );
}

export default function SignupPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">Get started — it&apos;s free</h1>
      <p className="mt-1 text-sm text-gray-600">
        Create your free account to match your business to live government tenders,
        see what you qualify for, and track deadlines.
      </p>
      <Card className="mt-6">
        <CardBody>
          <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
            <SignupForm />
          </Suspense>
        </CardBody>
      </Card>
      <p className="mt-4 text-center text-xs text-gray-500">
        GrowYourBiz staff?{" "}
        <Link href="/login" className="text-sa-green hover:underline">Staff sign in</Link>
      </p>
    </div>
  );
}
