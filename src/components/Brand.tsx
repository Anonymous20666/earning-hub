import React from "react";
import { ArrowUpRight } from "lucide-react";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <a
      className={`brand ${light ? "brand-light" : ""}`}
      href="#/"
      aria-label="Pappy Earning Hub home"
    >
      <span className="brand-symbol">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 19V5h7a4 4 0 0 1 0 8h-3M10 9h3M10 15v4"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="square"
          />
        </svg>
      </span>
      <span>
        pappy<span className="brand-sub">EARNING HUB</span>
      </span>
    </a>
  );
}
export function ArrowLink({
  children,
  href,
  className = "",
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <a href={href} className={`button ${className}`}>
      {children}
      <ArrowUpRight size={17} />
    </a>
  );
}
