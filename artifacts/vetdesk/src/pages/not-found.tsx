import { Link } from "wouter"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <div className="w-full max-w-lg rounded-[32px] border border-border/70 bg-card/90 p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
        <img src="/logo.svg" alt="VetDesk logo" className="mx-auto h-14 w-14" />
        <h1 className="mt-6 text-6xl font-bold text-primary">404</h1>
        <h2 className="mt-3 text-2xl font-semibold">Page not found</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          The page you are looking for doesn’t exist or may have moved.
        </p>
        <Link href="/">
          <Button className="mt-8">
            Return home
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
