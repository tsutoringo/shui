import { type LinkComponentProps } from "@cloudflare/kumo";
import { Link as RouterLink } from "@tanstack/react-router";
import { forwardRef } from "react";

export const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(function AppLink(
  { href, ...props },
  ref,
) {
  if (!href || href.startsWith("#") || href.startsWith("/api/") || isExternalHref(href)) {
    return <a ref={ref} href={href} {...props} />;
  }

  return <RouterLink ref={ref} to={href} {...props} />;
});

function isExternalHref(href: string) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href);
}
