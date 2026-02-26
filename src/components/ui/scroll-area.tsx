"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scroll-area"
      className={cn("relative overflow-auto", className)}
      {...props}
    >
      {children}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ScrollBar(_props: React.ComponentProps<"div"> & { orientation?: "vertical" | "horizontal" }) {
  // Kept for API compatibility. Native scrollbar is used instead of
  // radix-ui ScrollArea which has an infinite loop bug in v1.2.10.
  return null
}

export { ScrollArea, ScrollBar }
