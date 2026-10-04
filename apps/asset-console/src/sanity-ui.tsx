// Sanity UI v4 no longer injects its styles: the stylesheet must load before any component renders.
import "@sanity/ui/styles.css";

import { ThemeProvider, usePrefersDark } from "@sanity/ui";
import { buildTheme } from "@sanity/ui/theme";
import { ToastProvider } from "@sanity/ui/toast";
import type { ReactNode } from "react";
import { createGlobalStyle } from "styled-components";

const theme = buildTheme();

const GlobalStyle = createGlobalStyle`
  html, body {
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  button:active:not(:disabled) {
    scale: 0.96;
  }
  button {
    transition-property: scale;
    transition-duration: 120ms;
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition-duration: 0ms !important;
    }
  }
`;

export function SanityUI({ children }: { children: ReactNode }) {
  const prefersDark = usePrefersDark();
  return (
    <>
      <GlobalStyle />
      <ThemeProvider theme={theme} scheme={prefersDark ? "dark" : "light"}>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </>
  );
}
