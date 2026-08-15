import { HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-mode="dark" lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
