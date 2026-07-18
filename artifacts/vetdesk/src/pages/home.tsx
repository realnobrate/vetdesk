import { Link } from "wouter"
import { Button } from "@/components/ui/button"
import { Calendar, Users, Shield, ArrowRight, Sparkles } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/70 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2 text-primary">
            <img src="/logo.svg" alt="VetDesk logo" className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">VetDesk</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" className="font-medium text-muted-foreground hover:text-foreground">Log In</Button>
            </Link>
            <Link href="/sign-up">
              <Button className="font-semibold shadow-sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-6 py-24 md:py-32">
          <div className="container mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Sparkles className="mr-2 h-4 w-4" />
                Built for modern veterinary clinics
              </div>
              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-7xl">
                The CRM that moves at the speed of a front desk.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                VetDesk keeps owners, patients, appointments, and recalls in one calm workspace—so your team can stay focused on care.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/sign-up">
                  <Button size="lg" className="h-14 w-full px-8 text-base sm:w-auto">
                    Start your free clinic
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-16 overflow-hidden rounded-[28px] border border-border/70 bg-card/90 p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur md:p-8">
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-6">
                  <div className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">What teams love</div>
                  <div className="mt-4 space-y-3">
                    {[
                      "Fast patient lookups from any screen",
                      "A clear daily schedule with no friction",
                      "Automated recall follow-up without extra admin",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-xl bg-muted/30 px-3 py-3 text-sm text-foreground">
                        <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4 rounded-2xl bg-muted/40 p-5">
                  <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                    <div className="text-sm font-semibold text-foreground">Today’s front desk</div>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="text-3xl font-bold text-foreground">12</div>
                        <div className="text-sm text-muted-foreground">appointments</div>
                      </div>
                      <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">On track</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                    <div className="text-sm font-semibold text-foreground">Recall readiness</div>
                    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                      <span>Up next</span>
                      <span className="font-semibold text-foreground">4 follow-ups</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/20 px-6 py-20">
          <div className="container mx-auto max-w-6xl">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex flex-col items-center rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-xl font-bold">Owners & Pets</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Searchable client records with strong patient context, from species and breed to clinical history.
                </p>
              </div>

              <div className="flex flex-col items-center rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Calendar className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-xl font-bold">Appointments</h3>
                <p className="leading-relaxed text-muted-foreground">
                  A focused daily schedule that keeps the day moving without burying the important details.
                </p>
              </div>

              <div className="flex flex-col items-center rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-xl font-bold">Automated Recalls</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Log a vaccine or procedure and the next recall is scheduled automatically for the right follow-up.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-card px-6 py-8 text-center">
        <div className="container mx-auto">
          <div className="mb-4 flex items-center justify-center gap-2 opacity-70">
            <img src="/logo.svg" alt="VetDesk logo" className="h-4 w-4" />
            <span className="font-semibold">VetDesk</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} VetDesk Systems. Designed for independent clinics.
          </p>
        </div>
      </footer>
    </div>
  )
}
