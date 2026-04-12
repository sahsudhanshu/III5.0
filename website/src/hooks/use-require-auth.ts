import { useSession } from "next-auth/react";
import { useAuthModalStore } from "@/store/auth-modal-store";

export function useRequireAuth() {
  const { status } = useSession();
  const { openModal } = useAuthModalStore();

  const requireAuth = (action: () => void) => {
    if (status === "authenticated") {
      action();
    } else {
      openModal();
    }
  };

  return { requireAuth, isAuthenticated: status === "authenticated", isLoading: status === "loading" };
}
