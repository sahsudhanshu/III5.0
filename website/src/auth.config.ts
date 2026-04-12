import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      
      if (isLoggedIn && (nextUrl.pathname.startsWith("/auth/login") || nextUrl.pathname.startsWith("/auth/signup") || nextUrl.pathname === "/")) {
        // Redirect authenticated users to dashboard if they try to visit auth pages or home
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      
      // Allow access to all other routes, authenticated or not.
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
