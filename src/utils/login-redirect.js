// Where to send an anonymous visitor, and where to take them after login.

const isLoginPath = (path) => path === "/login" || path.startsWith("/login?");

// Anything but a plain in-app path (another site, a protocol-relative or
// backslash URL, the login page itself) falls back to the dashboard.
export function safeRedirect(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return isLoginPath(value) ? "/" : value;
}

export function loginLocation(fullPath) {
  const target = safeRedirect(fullPath);
  return target === "/"
    ? { path: "/login" }
    : { path: "/login", query: { redirect: target } };
}
