"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const PrintContext = createContext<(html: string) => void>(() => {});

export const usePrint = () => useContext(PrintContext);

// Renders HTML into the hidden #printArea (see globals.css @media print) and prints it.
export function PrintProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<string | null>(null);
  const printHtml = useCallback((html: string) => setContent(html), []);

  // Print once the content (including the logo image) is loaded, then clear it.
  useEffect(() => {
    if (content === null) return;
    let cancelled = false;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("#printArea img"));
    Promise.all(imgs.map((img) => (img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; })))).then(() => {
      if (cancelled) return;
      window.print();
      setContent(null);
    });
    return () => {
      cancelled = true;
    };
  }, [content]);

  return (
    <PrintContext.Provider value={printHtml}>
      {children}
      <div id="printArea" dangerouslySetInnerHTML={{ __html: content ?? "" }} />
    </PrintContext.Provider>
  );
}
