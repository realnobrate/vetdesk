import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Shell } from "@/components/layout/Shell"
import { getDashboardSummary, listOwners, listPets } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { CalendarClock, BellRing, Users, PawPrint, TriangleAlert as AlertTriangle, ArrowRight, Search } from "lucide-react"
import { Link } from "wouter"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/use-debounce"

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearch = useDebounce(searchTerm, 250)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => getDashboardSummary(),
  })

  const { data: ownersData } = useQuery({
    queryKey: ["dashboard-owners-search", debouncedSearch],
    queryFn: () => listOwners(debouncedSearch || undefined),
    enabled: debouncedSearch.trim().length > 0,
  })

  const { data: petsData } = useQuery({
    queryKey: ["dashboard-pets-search", debouncedSearch],
    queryFn: () => listPets({ search: debouncedSearch || undefined }),
    enabled: debouncedSearch.trim().length > 0,
  })

  const hasSearchQuery = debouncedSearch.trim().length > 0
  const ownerResults = useMemo(() => (ownersData ?? []).slice(0, 4), [ownersData])
  const petResults = useMemo(() => (petsData ?? []).slice(0, 4), [petsData])

  return (
    <Shell>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8 sm:space-y-8">
        <div className="rounded-[28px] border border-border/70 bg-gradient-to-br from-primary/8 via-background to-background p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                Clinic command center
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">Overview</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">Review appointments, recalls, and patient activity from a single polished overview.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
              <div className="font-semibold text-foreground">Live status</div>
              <div className="mt-1">Everything is synced and ready.</div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="py-5"><div className="h-5 bg-muted rounded w-1/3"></div></CardHeader>
                <CardContent><div className="h-8 bg-muted rounded w-1/2"></div></CardContent>
              </Card>
            ))}
          </div>
        ) : error || !data ? (
          <EmptyState
            title="Failed to load dashboard"
            description="We couldn't load today's data. Check your connection and try again."
            action={<Button onClick={() => refetch()}>Retry</Button>}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
              <Card className="border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    Today's Appointments
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <CalendarClock className="w-4 h-4" />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-foreground">{data.todayAppointments.length}</div>
                  <p className="mt-1 text-sm text-muted-foreground">Scheduled for today</p>
                </CardContent>
              </Card>

              <Card className="border border-emerald-500/10 bg-gradient-to-br from-emerald-500/10 via-background to-background shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    Total Owners
                    <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600">
                      <Users className="w-4 h-4" />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-foreground">{data.totalOwners}</div>
                  <p className="mt-1 text-sm text-muted-foreground">Active clients</p>
                </CardContent>
              </Card>

              <Card className="border border-sky-500/10 bg-gradient-to-br from-sky-500/10 via-background to-background shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    Total Pets
                    <div className="rounded-full bg-sky-500/10 p-2 text-sky-600">
                      <PawPrint className="w-4 h-4" />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-foreground">{data.totalPets}</div>
                  <p className="mt-1 text-sm text-muted-foreground">Patients on record</p>
                </CardContent>
              </Card>

              <Card className="border border-amber-500/10 bg-gradient-to-br from-amber-500/10 via-background to-background shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    Upcoming Recalls
                    <div className="rounded-full bg-amber-500/10 p-2 text-amber-600">
                      <BellRing className="w-4 h-4" />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-foreground">{data.upcomingRecallsCount}</div>
                  <p className="mt-1 text-sm text-muted-foreground">Pending follow-up</p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm border-0 bg-card/80">
              <CardHeader className="px-4 sm:px-6 pb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardTitle className="text-xl">Find patients and owners</CardTitle>
                    <CardDescription>Search across owners and patient records from the dashboard.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by owner or pet name"
                      className="pl-9 h-11"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Try a name, pet, or phone number.</p>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      Owners
                    </div>
                    {hasSearchQuery ? (
                      ownerResults.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {ownerResults.map(owner => (
                            <Link key={owner.id} href={`/owners/${owner.id}`} className="flex items-center justify-between rounded-lg border bg-background/70 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5">
                              <span className="font-medium">{owner.first_name} {owner.last_name}</span>
                              <span className="text-muted-foreground">{owner.phone}</span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-muted-foreground">No owner matches for this search.</div>
                      )
                    ) : (
                      <div className="mt-3 text-sm text-muted-foreground">Start typing to search owner records.</div>
                    )}
                  </div>

                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <PawPrint className="h-4 w-4 text-primary" />
                      Pets
                    </div>
                    {hasSearchQuery ? (
                      petResults.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {petResults.map(pet => (
                            <Link key={pet.id} href={`/pets/${pet.id}`} className="flex items-center justify-between rounded-lg border bg-background/70 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5">
                              <span className="font-medium">{pet.name}</span>
                              <span className="text-muted-foreground capitalize">{pet.species}</span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-muted-foreground">No pet matches for this search.</div>
                      )
                    ) : (
                      <div className="mt-3 text-sm text-muted-foreground">Start typing to search patient records.</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              <Card className="flex flex-col shadow-sm">
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Today's Schedule</CardTitle>
                      <CardDescription>Appointments for {formatDate(new Date().toISOString())}</CardDescription>
                    </div>
                    <Link href="/appointments">
                      <Button variant="outline" size="sm">View All</Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  <div className="divide-y">
                    {data.todayAppointments.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">No appointments scheduled for today.</div>
                    ) : (
                      data.todayAppointments.map(apt => (
                        <div key={apt.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                          <div className="min-w-0">
                            <div className="font-semibold flex flex-wrap items-center gap-2">
                              {formatDate(apt.scheduled_at, "h:mm a")}
                              <Badge variant={
                                apt.status === 'completed' ? 'success' :
                                apt.status === 'cancelled' || apt.status === 'no_show' ? 'outline' : 'default'
                              } className="text-[10px] px-1.5 py-0">
                                {apt.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="mt-1 font-medium text-sm text-foreground">
                              <Link href={`/pets/${apt.pet_id}`} className="hover:underline hover:text-primary">
                                {apt.pet.name}
                              </Link>
                              <span className="text-muted-foreground font-normal">
                                {" "}— {apt.owner.first_name} {apt.owner.last_name}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{apt.reason}</div>
                          </div>
                          <Link href={`/pets/${apt.pet_id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="flex flex-col shadow-sm border-destructive/20">
                <CardHeader className="border-b bg-destructive/5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Action Required
                      </CardTitle>
                      <CardDescription>Overdue recalls</CardDescription>
                    </div>
                    <Link href="/recalls?status=overdue">
                      <Button variant="outline" size="sm" className="border-destructive/20 text-destructive hover:bg-destructive/10">Manage</Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  <div className="divide-y divide-destructive/10">
                    {data.overdueRecalls.length === 0 ? (
                      <div className="p-8 text-center text-emerald-600 text-sm font-medium">All caught up! No overdue recalls.</div>
                    ) : (
                      data.overdueRecalls.map(recall => (
                        <div key={recall.id} className="p-4 hover:bg-destructive/5 transition-colors flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                          <div className="min-w-0">
                            <div className="font-semibold text-destructive text-sm flex items-center gap-2">
                              Due: {formatDate(recall.due_date)}
                            </div>
                            <div className="mt-1 font-medium text-sm text-foreground">
                              {recall.recall_type} for{" "}
                              <Link href={`/pets/${recall.pet_id}`} className="hover:underline hover:text-primary">
                                {recall.pet.name}
                              </Link>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Owner: {recall.owner.first_name} {recall.owner.last_name}
                              {recall.owner.phone ? ` • ${recall.owner.phone}` : ''}
                            </div>
                          </div>
                          <Link href={`/pets/${recall.pet_id}`}>
                            <Button variant="outline" size="sm" className="h-8 text-xs border-destructive/20 text-destructive hover:bg-destructive hover:text-white">
                              View Chart
                            </Button>
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}
