import { useMemo, useState } from "react"
import { Shell } from "@/components/layout/Shell"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listAppointments, createAppointment, updateAppointment, deleteAppointment, listPets
} from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { format, startOfDay } from "date-fns"
import { Calendar as CalendarIcon, Plus, Loader as Loader2, CheckCircle2, CircleOff, Clock3, Filter } from "lucide-react"
import { Link } from "wouter"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDebounce } from "@/hooks/use-debounce"

const apptSchema = z.object({
  petId: z.coerce.number().min(1, "Patient is required"),
  date: z.date({ required_error: "Date is required" }),
  time: z.string().min(1, "Time is required"),
  reason: z.string().min(1, "Reason is required"),
})

type AppointmentFilter = "all" | "scheduled" | "completed" | "cancelled"

export default function AppointmentsList() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const [filter, setFilter] = useState<AppointmentFilter>("all")
  const [cancelTarget, setCancelTarget] = useState<number | null>(null)
  const dateStr = format(selectedDate, "yyyy-MM-dd")
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [petSearch, setPetSearch] = useState("")
  const debouncedPetSearch = useDebounce(petSearch, 300)

  const { data: appointments, isLoading, isError } = useQuery({
    queryKey: ["appointments", dateStr],
    queryFn: () => listAppointments(dateStr),
  })

  const { data: petsData } = useQuery({
    queryKey: ["pets", debouncedPetSearch],
    queryFn: () => listPets({ search: debouncedPetSearch || undefined }),
  })

  const createMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      toast({ title: "Appointment scheduled" })
      setCreateOpen(false)
      form.reset()
      setPetSearch("")
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
    },
    onError: (err: any) => {
      toast({ title: "Failed to schedule appointment", description: err.message, variant: "destructive" })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateAppointment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      toast({ title: "Appointment updated" })
    },
    onError: (err: any) => {
      toast({ title: "Failed to update appointment", description: err.message, variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      toast({ title: "Appointment record deleted" })
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete appointment", description: err.message, variant: "destructive" })
    },
  })

  const form = useForm<z.infer<typeof apptSchema>>({
    resolver: zodResolver(apptSchema),
    defaultValues: { reason: "", time: "09:00" },
  })

  const filteredAppointments = useMemo(() => {
    if (!appointments) return []

    const sorted = [...appointments].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    if (filter === "all") return sorted

    return sorted.filter(apt => apt.status === filter)
  }, [appointments, filter])

  const onSubmit = (values: z.infer<typeof apptSchema>) => {
    const [hours, minutes] = values.time.split(":")
    const combinedDate = new Date(values.date)
    combinedDate.setHours(Number(hours), Number(minutes), 0, 0)

    setSelectedDate(startOfDay(values.date))

    createMutation.mutate({
      pet_id: values.petId,
      reason: values.reason,
      scheduled_at: combinedDate.toISOString(),
    })
  }

  const handleComplete = (id: number) => {
    updateMutation.mutate({ id, data: { status: "completed" } })
  }

  const handleCancel = () => {
    if (cancelTarget === null) return
    updateMutation.mutate({ id: cancelTarget, data: { status: "cancelled" } })
    setCancelTarget(null)
  }

  return (
    <Shell>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 overflow-x-hidden">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
            <p className="mt-1 text-muted-foreground">Manage today's schedule with clear filters, quick status updates, and a streamlined booking flow.</p>
          </div>
          <div className="flex flex-col gap-3 w-full md:w-auto md:flex-row md:items-center md:gap-4">
            <DatePicker date={selectedDate} setDate={(d) => d && setSelectedDate(d)} className="w-full md:w-[240px]" />
            <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { form.reset(); setPetSearch("") } }}>
              <DialogTrigger asChild>
                <Button className="w-full shadow-sm md:w-auto">
                  <Plus className="w-4 h-4 mr-2" /> New Appointment
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:max-w-lg sm:p-6">
                <DialogHeader>
                  <DialogTitle>Schedule Appointment</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-x-hidden">
                    <FormField control={form.control} name="petId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Patient</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value?.toString()}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Search patient..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            <div className="p-2 border-b">
                              <Input placeholder="Search name..." value={petSearch} onChange={e => setPetSearch(e.target.value)} className="h-8" />
                            </div>
                            <div className="max-h-[200px] overflow-auto">
                              {petsData?.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                              ))}
                            </div>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="date" render={({ field }) => (
                        <FormItem className="flex flex-col mt-2">
                          <FormLabel>Date</FormLabel>
                          <DatePicker date={field.value} setDate={field.onChange} />
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="time" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl><Input type="time" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="reason" render={({ field }) => (
                      <FormItem><FormLabel>Reason for visit</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="submit" disabled={createMutation.isPending} className="min-w-[120px]">
                        {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scheduling...</> : "Schedule"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isError && (
          <div className="p-4 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm">
            Failed to load appointments. Please try refreshing the page.
          </div>
        )}
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/10 p-4 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border bg-background px-2 py-1 text-sm text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  <span className="font-medium">Filter</span>
                </div>
                {(["all", "scheduled", "completed", "cancelled"] as AppointmentFilter[]).map(option => {
                  const isActive = filter === option
                  const label = option.charAt(0).toUpperCase() + option.slice(1)
                  return (
                    <Button
                      key={option}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilter(option)}
                      className={isActive ? "shadow-sm" : "bg-background"}
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : isError ? null : !appointments || appointments.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-muted-foreground/50" />
                </div>
                No appointments scheduled for this day.
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                No appointments match the selected filter.
              </div>
            ) : (
              <div className="divide-y">
                {filteredAppointments.map(apt => (
                  <div key={apt.id} className={`p-4 sm:p-6 flex flex-col gap-4 md:flex-row md:gap-4 md:justify-between md:items-start transition-all duration-200 hover:bg-muted/10 ${
                    apt.status === 'cancelled' || apt.status === 'no_show' ? 'opacity-70 bg-muted/20' : ''
                  }`}>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start w-full min-w-0">
                      <div className="w-full sm:w-24 text-left sm:text-right pt-1 shrink-0">
                        <div className="text-lg font-bold text-foreground">{formatDate(apt.scheduled_at, "h:mm a")}</div>
                        <Badge variant={
                          apt.status === 'completed' ? 'success' :
                          apt.status === 'cancelled' || apt.status === 'no_show' ? 'outline' : 'default'
                        } className="mt-1 text-[10px] w-full justify-center">
                          {apt.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="w-full min-w-0 border-t pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:py-1">
                        <Link href={`/pets/${apt.pet_id}`} className="text-xl font-bold text-primary hover:underline">
                          {apt.pet.name}
                        </Link>
                        <div className="text-sm font-medium text-foreground mt-1">{apt.reason}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Owner: <Link href={`/owners/${apt.owner.id}`} className="hover:text-foreground">
                            {apt.owner.first_name} {apt.owner.last_name}
                          </Link> • {apt.owner.phone}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:gap-2 sm:justify-end sm:w-auto">
                      {apt.status === 'scheduled' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto border-emerald-600/30 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleComplete(apt.id)}
                            disabled={updateMutation.isPending}
                          >
                            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Arrived / Done
                          </Button>
                          <Dialog open={cancelTarget === apt.id} onOpenChange={(open) => setCancelTarget(open ? apt.id : null)}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="w-full sm:w-auto border-destructive/30 text-destructive hover:bg-destructive/10" disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleOff className="mr-2 h-4 w-4" />}
                                Cancel
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Cancel appointment?</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground">This will mark the appointment as cancelled. You can still delete it later if needed.</p>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setCancelTarget(null)}>Keep</Button>
                                <Button variant="destructive" onClick={handleCancel}>Confirm Cancel</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                      {(apt.status === 'cancelled' || apt.status === 'completed') && (
                        <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => deleteMutation.mutate(apt.id)} disabled={deleteMutation.isPending}>
                          {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Delete Record
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  )
}
