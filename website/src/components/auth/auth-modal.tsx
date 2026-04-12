"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Activity } from "lucide-react";
import { toast } from "sonner";
import { useAuthModalStore } from "@/store/auth-modal-store";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function AuthModal() {
  const { isOpen, closeModal, callbackUrl, reason } = useAuthModalStore();
  const pathname = usePathname();
  const router = useRouter();
  const safeCallbackUrl = callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setPassword("");
      setShowPassword(false);
    }
  }, [isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please enter your credentials"); return; }
    
    setIsLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: safeCallbackUrl,
      });

      if (res?.error) {
        toast.error("Invalid credentials.");
      } else {
        toast.success("Authentication successful! 🎉");
        closeModal();
        if (pathname !== safeCallbackUrl) {
          router.push(safeCallbackUrl);
        }
        router.refresh();
      }
    } catch {
      toast.error("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    closeModal();
    signIn("google", { callbackUrl: safeCallbackUrl });
  };

  return (
    <Dialog open={isOpen} onOpenChange={closeModal}>
      <DialogContent className="max-w-[400px] p-0 border-none bg-transparent shadow-none [&>button]:hidden sm:rounded-3xl">
        <DialogTitle className="sr-only">Authenticate to continue</DialogTitle>
        <div className="relative w-full p-8 sm:p-10 rounded-[2rem] overflow-hidden">
          {/* Glassmorphism Container */}
          <div className="absolute inset-0 bg-[#050914]/90 backdrop-blur-3xl border border-white/[0.08] shadow-[0_0_80px_rgba(0,0,0,0.8)] -z-10" />
          
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[130px] mix-blend-screen animate-pulse pointer-events-none" />

          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary to-blue-500 flex items-center justify-center shadow-[0_0_40px_rgba(0,208,156,0.4)] mb-4 relative group">
              <Activity className="w-6 h-6 text-white" />
              <div className="absolute inset-0 rounded-2xl border border-white/20" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-2 text-center">
              Action <span className="text-primary">Locked</span>
            </h2>
            <p className="text-white/50 text-xs font-medium tracking-wide text-center">
              {reason ?? "Authenticate to access this feature"}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com" 
                  className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono group-hover:border-white/20" 
                  autoComplete="email" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Password</label>
              </div>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-12 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono group-hover:border-white/20"
                  autoComplete="current-password"
                />
                <button 
                  type="button" 
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-white/40 hover:text-white transition-colors" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,208,156,0.2)] hover:shadow-[0_0_30px_rgba(0,208,156,0.4)] disabled:opacity-70 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
              {isLoading
                ? <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Authenticating…</>
                : "Authorize Access"
              }
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/5" />
            </div>
            <div className="relative flex justify-center text-[9px] uppercase font-bold tracking-widest">
              <span className="bg-[#050914] px-4 text-white/40 border border-white/5 rounded-full py-1">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full h-11 bg-white/[0.03] border border-white/10 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-3 hover:bg-white/[0.08] hover:border-white/20 transition-all group"
          >
            <div className="bg-white p-0.5 rounded-full group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 24 24" className="w-[14px] h-[14px]">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            Google SSO
          </button>

          <p className="text-center text-[11px] text-white/45 mt-4">
            Need an account?{" "}
            <Link
              href={`/auth/signup?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`}
              className="text-primary font-semibold hover:text-primary/80 transition-colors"
              onClick={() => closeModal()}
            >
              Create one
            </Link>
          </p>
          
          <div className="absolute top-4 right-4 animate-pulse">
            <span className="flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
