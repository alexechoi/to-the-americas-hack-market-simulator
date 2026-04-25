"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { initAnalytics, logPageView } from "../lib/firebase/analytics";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const initialized = useRef(false);

  // Initialize analytics once on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initAnalytics();
    }
  }, []);

  // Log page views on route change
  useEffect(() => {
    logPageView(pathname);
  }, [pathname]);

  return <>{children}</>;
}
