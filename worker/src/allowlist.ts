export const ALLOWED_ENDPOINTS = ['/games', '/leagues', '/teams'] as const;

export type AllowedEndpoint = (typeof ALLOWED_ENDPOINTS)[number];

export function getAllowedEndpoint(pathname: string): AllowedEndpoint | null {
  return ALLOWED_ENDPOINTS.find((ep) => pathname === ep || pathname.startsWith(`${ep}/`)) ?? null;
}

export function isAllowedEndpoint(pathname: string): boolean {
  return getAllowedEndpoint(pathname) !== null;
}
