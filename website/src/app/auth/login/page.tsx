"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, TrendingUp, Zap, Shield } from "lucide-react";
import { toast } from "sonner";

const FEATURES = [
  { icon: TrendingUp, title: "Real-time NSE Data",    desc: "Live prices, charts & analytics" },
  { icon: Zap,        title: "AI-Powered Insights",   desc: "Aria AI gives you market intelligence" },
  { icon: Shield,     title: "Secure & Reliable",     desc: "Bank-grade security for your portfolio" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState("demo@tradeiq.in");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please enter your credentials"); return; }
    try {
      await login(email, password);
      toast.success("Welcome back! 🎉");
      router.push("/dashboard");
    } catch {
      toast.error("Login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Left: form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-black text-lg">G</span>
            </div>
            <span className="font-bold text-xl tracking-tight">
              Trade<span className="text-primary">IQ</span>
            </span>
          </div>

          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm mb-8">Sign in to continue to your portfolio</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" className="h-11" autoComplete="email" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-foreground">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 pr-10"
                  autoComplete="current-password"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 btn-groww rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
            >
              {isLoading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in…</>
                : "Sign in"
              }
            </button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-primary font-semibold hover:underline">
              Create account
            </Link>
          </p>

          {/* Demo badge */}
          <div className="mt-6 p-3 rounded-xl bg-primary/5 border border-primary/15 text-center">
            <p className="text-xs text-muted-foreground">
              🎯 Demo credentials are pre-filled — just click <strong>Sign in</strong>
            </p>
          </div>
        </div>
      </div>

      {/* ── Right: illustration ── */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#0d2b22] via-[#0f3028] to-[#0a1f1a] flex-col items-center justify-center p-16 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

        <div className="relative z-10 max-w-md text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30 mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-primary text-xs font-semibold">Markets are open</span>
          </div>

          <h2 className="text-4xl font-black text-white mb-4 leading-tight">
            Invest smarter with{" "}
            <span className="text-primary">AI-powered</span> insights
          </h2>
          <p className="text-white/50 mb-10 text-base leading-relaxed">
            Real-time NSE data, advanced charts, and intelligent portfolio analytics all in one place.
          </p>

          <div className="space-y-3 text-left">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-white/40 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
