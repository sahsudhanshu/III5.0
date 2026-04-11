import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnApp = nextUrl.pathname.startsWith("/dashboard") || 
                      nextUrl.pathname.startsWith("/explore") || 
                      nextUrl.pathname.startsWith("/portfolio") || 
                      nextUrl.pathname.startsWith("/transactions") || 
                      nextUrl.pathname.startsWith("/watchlist") || 
                      nextUrl.pathname.startsWith("/news") || 
                      nextUrl.pathname.startsWith("/settings") || 
                      nextUrl.pathname.startsWith("/markets");

      if (isOnApp) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn && (nextUrl.pathname.startsWith("/auth/login") || nextUrl.pathname.startsWith("/auth/signup") || nextUrl.pathname === "/")) {
        // Redirect authenticated users to dashboard if they try to visit auth pages or home
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.provider = account?.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
        // In NextAuth v5 types, we might need to extend it to include custom fields if needed
      }
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now, real providers go in auth.ts
} satisfies NextAuthConfig;
