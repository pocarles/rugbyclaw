export const ALLOWED_ENDPOINTS = ['/games', '/leagues', '/teams'] as const;

export function isAllowedEndpoint(pathname: string): boolean {
  return ALLOWED_ENDPOINTS.some((ep) => pathname === ep || pathname.startsWith(`${ep}/`));
}
