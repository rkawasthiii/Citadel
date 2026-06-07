import { NextRequest, NextResponse } from "next/server";

// Public routes that don't require authentication
const publicRoutes = [
  "/sign-in",
  "/sign-up", 
  "/handler", // Stack Auth handler routes
  "/api/inngest", // Inngest webhook
  "/api/webhooks", // Webhook routes
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for any Stack Auth related cookies
  // Stack Auth uses cookies prefixed with the project ID or "stack-"
  const cookies = request.cookies.getAll();
  const hasAuthCookie = cookies.some(cookie => 
    cookie.name.includes("stack") || 
    cookie.name.includes("refresh") ||
    cookie.name.includes("session")
  );

  // For API routes, return 401 if not authenticated
  if (pathname.startsWith("/api/")) {
    if (!hasAuthCookie) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // For page routes, redirect to custom sign-in page if not authenticated
  if (!hasAuthCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("after_auth_return_to", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
