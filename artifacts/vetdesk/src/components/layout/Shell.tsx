import * as React from "react"
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"
import { Activity, Calendar, Users, Bell, LogOut, Loader as Loader2, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getClinic } from "@/lib/api"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/owners", label: "Owners & Pets", icon: Users },
  { href: "/recalls", label: "Recalls", icon: Bell },
  {
    href: "/staff",
    label: "Staff",
    icon: Users,
    adminOnly: true,
  },
  {
    label: "Clinic Settings",
    href: "/clinic-settings",
    icon: Settings,
    adminOnly: true,
  },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation()
  const { signOut, staff, loading } = useAuth()
  const clinicId = staff?.clinic_id ?? 0

const { data: clinic } = useQuery({
  queryKey: ["clinic", clinicId],
  queryFn: () => getClinic(clinicId),
  enabled: clinicId > 0,
})

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
    <div className="h-16 flex items-center px-6 border-b border-sidebar-border/70 gap-3 shrink-0">
  <div className="h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center bg-white/10 shrink-0">
    <img
      src={clinic?.logo_url || "/logo.svg"}
      alt={`${clinic?.name || "VetDesk"} logo`}
      className="h-full w-full object-cover"
    />
  </div>

  <span className="text-lg font-semibold tracking-tight text-white truncate">
    {clinic?.name || "VetDesk"}
  </span>
</div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => !item.adminOnly || staff?.role === "admin")
          .map((item) => {
          const isActive = location === item.href || location.startsWith(`${item.href}/`)
          return (
            <Link key={item.href} href={item.href} className="block" onClick={onNavigate}>
              <div
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-white shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-white"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border shrink-0">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-sidebar-accent/30 px-3 py-3">
          <div className="flex-1 min-w-0">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-sidebar-foreground/50" />
            ) : (
              <>
                <p className="text-sm font-medium text-white truncate">{staff?.name ?? "Staff"}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate capitalize">
                  {staff?.role?.replace("_", " ") ?? ""}
                </p>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-white"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-sidebar-foreground/60">
          VetDesk • clinic operations
        </div>
      </div>
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 border-r border-sidebar-border/70 bg-sidebar/95 shadow-[12px_0_30px_-20px_rgba(15,23,42,0.4)] md:flex flex-shrink-0 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile top bar + drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <div className="md:hidden fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b border-sidebar-border/70 bg-sidebar/95 px-4 text-sidebar-foreground backdrop-blur">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2 text-white hover:bg-sidebar-accent/50 hover:text-white">
              <Menu className="w-5 h-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="VetDesk logo" className="h-7 w-7" />
            <span className="font-bold tracking-tight text-white">VetDesk</span>
          </div>
        </div>
        <SheetContent side="left" className="p-0 w-72">
          <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pt-14 md:pt-0">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
