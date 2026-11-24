import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions, isTokenExpired, refreshTokens } from "@/lib/backend/auth-tokens";

// Keeps the dashboard session fresh before any page renders.
// No valid session -> back to the login page.
export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken && !isTokenExpired(accessToken)) return NextResponse.next();

  const storedRefreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const tokens = storedRefreshToken ? await refreshTokens(storedRefreshToken) : null;

  if (!tokens) {
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  // Make the new tokens visible to this request's rendering...
  request.cookies.set(ACCESS_COOKIE, tokens.accessToken);
  request.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  // ...and store them in the browser.
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions);
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};