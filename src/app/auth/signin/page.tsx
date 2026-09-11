"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignInPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [profileName, setProfileName] = useState("");

  const handleGoogleSignIn = async () => {
    setLoading(true);
    await signIn("google", { redirect: false });
    setLoading(false);
  };

  const handleCreateProfile = async () => {
    if (!profileName.trim()) {
      alert("Enter your name");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          avatar: "a1",
          lang: "fr",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        router.push("/");
      } else {
        alert("Error: " + data.error);
      }
    } catch (e) {
      alert("Failed to create profile: " + (e instanceof Error ? e.message : ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">
          HORIZON Academy
        </h1>
        <p className="text-purple-300 text-center mb-8">
          Sign in to continue your cybersecurity journey
        </p>

        {!session ? (
          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full px-4 py-3 bg-white text-slate-900 font-semibold rounded-lg hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Signing in..." : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800/50 text-slate-400">
                  Or continue as guest
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Enter your name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
              <button
                onClick={handleCreateProfile}
                disabled={loading || !profileName.trim()}
                className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Play as Guest"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <p className="text-sm text-slate-400">Signed in as</p>
              <p className="text-white font-semibold">{session.user?.email}</p>
            </div>
            <button
              onClick={() => signOut({ redirect: true })}
              className="w-full px-4 py-2 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}