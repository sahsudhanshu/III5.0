import { create } from "zustand";

interface AuthModalOptions {
  callbackUrl?: string;
  reason?: string;
}

interface AuthModalState {
  isOpen: boolean;
  callbackUrl: string;
  reason: string | null;
  openModal: (options?: AuthModalOptions) => void;
  closeModal: () => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  isOpen: false,
  callbackUrl: "/dashboard",
  reason: null,
  openModal: (options) => set({
    isOpen: true,
    callbackUrl: options?.callbackUrl ?? "/dashboard",
    reason: options?.reason ?? null,
  }),
  closeModal: () => set({ isOpen: false, reason: null }),
}));
