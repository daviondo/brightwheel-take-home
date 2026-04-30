"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setDemoParent, setDemoOperator } from "@/app/actions";

interface DemoBannerProps {
  currentName: string;
  personas: Array<{ id: string; name: string }>;
  mode: "parent" | "operator";
}

export function DemoBanner({ currentName, personas, mode }: DemoBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleSelect(id: string | null) {
    startTransition(async () => {
      if (mode === "parent") {
        await setDemoParent(id);
      } else {
        await setDemoOperator(id);
      }
      router.refresh();
    });
  }

  return (
    <div
      className="w-full border-b bg-white/80 backdrop-blur-sm px-4 py-2"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="mx-auto max-w-2xl flex items-center gap-2 text-sm">
        <span className="text-muted-fg font-medium">Demo mode:</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isPending}
            className="flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors focus:outline-none"
          >
            viewing as {currentName}
            <ChevronDown className="h-3.5 w-3.5 text-muted-fg" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            {personas.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => handleSelect(p.id)}
                className={p.name === currentName ? "font-semibold" : ""}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
            {mode === "parent" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => handleSelect(null)}
                  className="text-muted-fg"
                >
                  Guest (anonymous)
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
