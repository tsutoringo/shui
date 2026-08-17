export function getSetupRedirect(pathname: string, status: number, available: boolean) {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (normalizedPath === "/setup") {
    return status === 404 ? "/sign-in" : undefined;
  }

  return available ? "/setup" : undefined;
}
