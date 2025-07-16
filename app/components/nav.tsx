"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"

const navigation = [
  // Additional navigation items can be added here
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center space-x-1">
      {/* Creators Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
            pathname === "/creators" || pathname === "/scraper"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          Creators
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild>
            <Link href="/creators" className="cursor-pointer">
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/scraper" className="cursor-pointer">
              Finder
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Other navigation items */}
      {navigation.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          className={cn(
            "px-3 py-2 text-sm font-medium rounded-md transition-colors",
            pathname === item.href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  )
}