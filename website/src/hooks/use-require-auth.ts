import { useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuthModalStore } from "@/store/auth-modal-store";

export function useRequireAuth() {
  const { status } = useSession();
  const { openModal } = useAuthModalStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requireAuth = (action: () => void, reason?: string) => {
    if (status === "authenticated") {
      action();
    } else {
      const qs = searchParams?.toString();
      const callbackUrl = qs ? `${pathname}?${qs}` : pathname;
      openModal({ callbackUrl, reason });
    }
  };

  return { requireAuth, isAuthenticated: status === "authenticated", isLoading: status === "loading" };
}
