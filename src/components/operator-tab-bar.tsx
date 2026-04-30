"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, BookOpen, Activity } from "lucide-react";

const tabs = [
  { href: "/operator", label: "Inbox", icon: Inbox },
  { href: "/operator/policies", label: "Policies", icon: BookOpen },
  { href: "/operator/activity", label: "Activity", icon: Activity },
];

export function OperatorTabBar() {
  const pathname = usePathname();

  return (
    <nav className="border-t bg-white md:border-t-0 md:border-r md:flex md:flex-col md:w-56 md:min-h-screen md:pt-4">
      <ul className="flex md:flex-col">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/operator"
              ? pathname === "/operator" || pathname.startsWith("/operator/conversation")
              : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                className={[
                  "flex flex-col items-center gap-0.5 px-2 py-3 min-h-[56px] justify-center text-sm font-medium transition-colors",
                  "md:flex-row md:gap-3 md:px-4 md:py-3 md:min-h-0 md:text-sm md:rounded-lg md:mx-2 md:mb-1",
                  active
                    ? "text-primary md:bg-primary/10"
                    : "text-muted-fg hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
