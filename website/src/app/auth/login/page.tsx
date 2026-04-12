"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Activity } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl") || "/dashboard";
  const callbackUrl = rawCallback.startsWith("/") ? rawCallback : "/dashboard";
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please enter your credentials"); return; }
    
    setIsLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        toast.error("Invalid credentials.");
      } else {
        toast.success("Welcome back! 🎉");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      toast.error("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#050914] selection:bg-primary/30">
      {/* Premium Animated Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[130px] mix-blend-screen animate-pulse pointer-events-none" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/15 blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[35%] h-[35%] rounded-full bg-emerald-500/10 blur-[100px] mix-blend-screen pointer-events-none" />

      {/* Grid overlay for texture */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_20%,transparent_100%)] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md p-8 sm:p-10 md:mx-0 mx-4"
      >
        {/* Glassmorphism Container */}
        <div className="absolute inset-0 rounded-[2rem] backdrop-blur-2xl bg-white/[0.015] border border-white/[0.05] shadow-[0_0_80px_rgba(0,0,0,0.8)] -z-10" />

        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary to-blue-500 flex items-center justify-center shadow-[0_0_40px_rgba(0,208,156,0.4)] mb-6 relative group cursor-pointer">
            <Activity className="w-8 h-8 text-white group-hover:scale-110 transition-transform duration-300" />
            <div className="absolute inset-0 rounded-2xl border border-white/20" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            Trade<span className="text-primary">IQ</span>
          </h1>
          <p className="text-white/50 text-sm font-medium tracking-wide">Enter the analytics terminal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative group">
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" 
                className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono group-hover:border-white/20" 
                autoComplete="email" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Password</label>
            </div>
            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 pr-12 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono group-hover:border-white/20"
                autoComplete="current-password"
              />
              <button 
                type="button" 
                className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-white/40 hover:text-white transition-colors" 
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,208,156,0.2)] hover:shadow-[0_0_30px_rgba(0,208,156,0.4)] disabled:opacity-70 disabled:hover:shadow-[0_0_20px_rgba(0,208,156,0.2)] relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
            
            {isLoading
              ? <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Authenticating…</>
              : "Access Terminal"
            }
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/5" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
            <span className="bg-[#050914] px-4 text-white/40 border border-white/5 rounded-full py-1 backdrop-blur-xl">Or authenticte with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full h-12 bg-white/[0.03] border border-white/10 text-white font-semibold rounded-xl flex items-center justify-center gap-3 hover:bg-white/[0.08] hover:border-white/20 transition-all group"
        >
          <div className="bg-white p-1 rounded-full group-hover:scale-110 transition-transform">
            <svg viewBox="0 0 24 24" className="w-4 h-4">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          </div>
          Google
        </button>

        <p className="text-sm text-white/50 text-center mt-8 font-medium">
          No account yet?{" "}
          <Link href={`/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-primary font-bold hover:text-primary/80 transition-colors">
            Initialize one here
          </Link>
        </p>

        {/* Demo instructions */}
        <div className="absolute -bottom-16 left-0 right-0 text-center">
          <p className="text-[11px] font-medium tracking-wide text-white/30">
            Demo credentials are pre-filled. Just click <strong className="text-white/60">Access Terminal</strong>.
          </p>
        </div>
      </motion.div>
      
      {/* Inline styles for the shimmer keyframes used in the button */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(150%) skewX(-20deg); }
        }
      `}} />
    </div>
  );
}
