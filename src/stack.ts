import "server-only";

import { StackServerApp } from "@stackframe/stack";

// Check if Stack Auth is configured
export const isStackAuthConfigured = !!(
  process.env.NEXT_PUBLIC_STACK_PROJECT_ID && 
  process.env.NEXT_PUBLIC_STACK_PROJECT_ID !== "your_neon_auth_project_id"
);

// Create the app - will be null if not configured
let _stackServerApp: StackServerApp | null = null;

if (isStackAuthConfigured) {
  _stackServerApp = new StackServerApp({ 
    tokenStore: "nextjs-cookie",
    urls: {
      signIn: "/sign-in",
      signUp: "/sign-up",
      afterSignIn: "/",
      afterSignUp: "/onboarding",
    },
  });
}

export const stackServerApp = _stackServerApp;
