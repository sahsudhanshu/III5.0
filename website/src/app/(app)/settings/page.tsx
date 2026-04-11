"use client";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { Sun, Moon, User, Shield } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <User className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Profile</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Full Name</label>
            <Input className="mt-1.5 h-9" defaultValue={user?.name || ""} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input className="mt-1.5 h-9" defaultValue={user?.email || ""} type="email" disabled />
          </div>
        </div>
        <Button size="sm">Save Changes</Button>
      </div>

      {/* Appearance */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <Sun className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Appearance</h2>
        </div>
        <div className="flex gap-3">
          {["light", "dark"].map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === t ? "border-primary bg-primary/5" : "border-border"}`}
            >
              {t === "light" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="text-sm font-medium capitalize">{t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Plan */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Subscription</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Pro Plan</p>
            <p className="text-xs text-muted-foreground">Advanced analytics, real-time data, AI chatbot</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">Active</span>
        </div>
      </div>
    </div>
  );
}
