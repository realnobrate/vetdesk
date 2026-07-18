import { useState, useEffect } from "react"
import { Shell } from "@/components/layout/Shell"
import { useParams, Link } from "wouter"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPet, updatePet, createVisit, createRecall, updateRecall } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/format"
import { ArrowLeft, PawPrint, Calendar, Weight, Loader as Loader2, Save, User, Syringe, Clock, FileText, Bell, CircleCheck as CheckCircle, Plus } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"

const visitSchema = z.object({
  visit_date: z.string().trim().min(1, "Date is required"),
  reason: z.string().trim().min(1, "Reason is required"),
  weight_lb: z.union([z.coerce.number().positive("Weight must be positive"), z.literal("")]).optional(),
  notes: z.string().optional().or(z.literal("")),
  meds_prescribed: z.string().optional().or(z.literal("")),
  vaccines_administered: z.string().optional().or(z.literal("")),
  vet_name: z.string().optional().or(z.literal("")),
})

const recallSchema = z.object({
  recall_type: z.string().trim().min(1, "Type is required"),
  due_date: z.string().trim().min(1, "Due date is required"),
  notes: z.string().optional().or(z.literal("")),
})

export default function PetDetail() {
  const { id } = useParams()
  const petId = Number(id)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: petData, isLoading } = useQuery({
    queryKey: ["pet", petId],
    queryFn: () => getPet(petId),
    enabled: !!petId,
  })

  const updatePetMutation = useMutation({
    mutationFn: (data: Parameters<typeof updatePet>[1]) => updatePet(petId, data),
    onSuccess: () => {
      setIsEditing(false)
      toast({ title: "Chart updated" })
      queryClient.invalidateQueries({ queryKey: ["pet", petId] })
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  })

  const createVisitMutation = useMutation({
    mutationFn: (values: z.infer<typeof visitSchema>) =>
      createVisit(petId, {
        visit_date: new Date(values.visit_date).toISOString(),
        reason: values.reason,
        weight_lb: values.weight_lb ? Number(values.weight_lb) : null,
        notes: values.notes || null,
        meds_prescribed: values.meds_prescribed || null,
        vaccines_administered: values.vaccines_administered
          ? values.vaccines_administered.split(",").map(s => s.trim()).filter(Boolean)
          : [],
        vet_name: values.vet_name || null,
      }),
    onSuccess: () => {
      toast({ title: "Visit logged" })
      setVisitModalOpen(false)
      visitForm.reset()
      queryClient.invalidateQueries({ queryKey: ["pet", petId] })
    },
    onError: (err: any) => toast({ title: "Failed to log visit", description: err.message, variant: "destructive" }),
  })

  const createRecallMutation = useMutation({
    mutationFn: (values: z.infer<typeof recallSchema>) =>
      createRecall({
        pet_id: petId,
        recall_type: values.recall_type,
        due_date: values.due_date,
        status: "upcoming",
        notes: values.notes || null,
        visit_id: null,
      }),
    onSuccess: () => {
      toast({ title: "Recall scheduled" })
      setRecallModalOpen(false)
      recallForm.reset()
      queryClient.invalidateQueries({ queryKey: ["pet", petId] })
    },
  })

  const updateRecallMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "completed" | "sent" }) =>
      updateRecall(id, { status }),
    onSuccess: (_, { status }) => {
      toast({ title: `Recall marked as ${status}` })
      queryClient.invalidateQueries({ queryKey: ["pet", petId] })
    },
  })

  const [isEditing, setIsEditing] = useState(false)
  const [visitModalOpen, setVisitModalOpen] = useState(false)
  const [recallModalOpen, setRecallModalOpen] = useState(false)

  const [editData, setEditData] = useState({
    name: "", species: "dog", breed: "", sex: "unknown", birth_date: "", weight_lb: "", notes: ""
  })

  useEffect(() => {
    if (petData && !isEditing) {
      setEditData({
        name: petData.name,
        species: petData.species,
        breed: petData.breed || "",
        sex: petData.sex || "unknown",
        birth_date: petData.birth_date ? petData.birth_date.split("T")[0] : "",
        weight_lb: petData.weight_lb?.toString() || "",
        notes: petData.notes || "",
      })
    }
  }, [petData, isEditing])

  const visitForm = useForm<z.infer<typeof visitSchema>>({
    resolver: zodResolver(visitSchema),
    defaultValues: { visit_date: new Date().toISOString().split("T")[0], reason: "", weight_lb: "", notes: "", meds_prescribed: "", vaccines_administered: "", vet_name: "" },
  })

  const recallForm = useForm<z.infer<typeof recallSchema>>({
    resolver: zodResolver(recallSchema),
    defaultValues: { recall_type: "", due_date: "", notes: "" },
  })

  if (isLoading) return <Shell><div className="p-8 flex justify-center"><Loader2 className="animate-spin text-muted-foreground w-8 h-8" /></div></Shell>
  if (!petData) return <Shell><div className="p-8 text-center">Pet not found.</div></Shell>

  return (
    <Shell>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <Link href={`/owners/${petData.owner_id}`} className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to {petData.owner.first_name}'s Account
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
                <PawPrint className="w-10 h-10" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-extrabold tracking-tight text-foreground">{petData.name}</h1>
                  <Badge variant="secondary" className="uppercase tracking-widest text-[10px] px-2 py-0.5">{petData.species}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" /> Owner:{" "}
                    <Link href={`/owners/${petData.owner_id}`} className="text-primary hover:underline">
                      {petData.owner.first_name} {petData.owner.last_name}
                    </Link>
                  </span>
                  <span>•</span>
                  <span>{petData.breed || "Mixed Breed"}</span>
                  <span>•</span>
                  <span className="capitalize">{petData.sex || "Unknown sex"}</span>
                </div>
              </div>
            </div>
            <Button onClick={() => setIsEditing(!isEditing)} variant={isEditing ? "outline" : "secondary"} className="w-full sm:w-auto">
              {isEditing ? "Cancel Edit" : "Edit Chart Details"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Chart Details */}
          <div className="space-y-6">
            <Card className="shadow-sm border-primary/10">
              <CardHeader className="bg-muted/10 pb-4 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Chart Details</CardTitle>
                {isEditing && (
                  <Button size="sm" onClick={() => updatePetMutation.mutate({
                    name: editData.name,
                    species: editData.species as any,
                    breed: editData.breed || null,
                    sex: editData.sex as any,
                    birth_date: editData.birth_date || null,
                    weight_lb: editData.weight_lb ? Number(editData.weight_lb) : null,
                    notes: editData.notes || null,
                  })} disabled={updatePetMutation.isPending || !editData.name.trim()}>
                    {updatePetMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-5">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-1"><Label>Name *</Label><Input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Species</Label>
                        <Select value={editData.species} onValueChange={v => setEditData({ ...editData, species: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dog">Dog</SelectItem>
                            <SelectItem value="cat">Cat</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>Breed</Label><Input value={editData.breed} onChange={e => setEditData({ ...editData, breed: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Sex</Label>
                        <Select value={editData.sex} onValueChange={v => setEditData({ ...editData, sex: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>Weight (lbs)</Label><Input type="number" step="0.1" value={editData.weight_lb} onChange={e => setEditData({ ...editData, weight_lb: e.target.value })} /></div>
                    </div>
                    <div className="space-y-1"><Label>Birth Date</Label><Input type="date" value={editData.birth_date} onChange={e => setEditData({ ...editData, birth_date: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Notes</Label><Textarea className="h-32" value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} /></div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-lg border border-border/50">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                        <div><div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Born</div><div className="font-semibold text-sm">{formatDate(petData.birth_date) || "Unknown"}</div></div>
                      </div>
                      <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-lg border border-border/50">
                        <Weight className="w-5 h-5 text-muted-foreground" />
                        <div><div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Weight</div><div className="font-semibold text-sm">{petData.weight_lb ? `${petData.weight_lb} lbs` : "Not recorded"}</div></div>
                      </div>
                    </div>
                    {petData.notes && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900/30">
                        <div className="text-[10px] uppercase font-bold text-yellow-800 dark:text-yellow-600 tracking-wider mb-1">Chart Notes</div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{petData.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* History / Timeline */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="visits" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 p-1 bg-muted/30">
                <TabsTrigger value="visits" className="font-semibold">Visit History</TabsTrigger>
                <TabsTrigger value="recalls" className="font-semibold">Recalls & Preventative</TabsTrigger>
              </TabsList>

              <TabsContent value="visits" className="space-y-4 outline-none">
                <div className="flex justify-end">
                  <Dialog open={visitModalOpen} onOpenChange={setVisitModalOpen}>
                    <DialogTrigger asChild>
                      <Button className="shadow-sm w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> Log Visit</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader><DialogTitle>Log Clinical Visit</DialogTitle></DialogHeader>
                      <Form {...visitForm}>
                        <form onSubmit={visitForm.handleSubmit(v => createVisitMutation.mutate(v))} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={visitForm.control} name="visit_date" render={({ field }) => (
                              <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={visitForm.control} name="vet_name" render={({ field }) => (
                              <FormItem><FormLabel>Attending Vet (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                          </div>
                          <FormField control={visitForm.control} name="reason" render={({ field }) => (
                            <FormItem><FormLabel>Reason / Chief Complaint</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={visitForm.control} name="weight_lb" render={({ field }) => (
                              <FormItem><FormLabel>Weight (lbs)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={visitForm.control} name="vaccines_administered" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Vaccines (Comma separated)</FormLabel>
                                <FormControl><Input placeholder="e.g. Rabies, DHPP" {...field} /></FormControl>
                                <FormDescription>Known vaccines will auto-schedule a recall.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={visitForm.control} name="meds_prescribed" render={({ field }) => (
                            <FormItem><FormLabel>Medications Prescribed</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={visitForm.control} name="notes" render={({ field }) => (
                            <FormItem><FormLabel>Clinical Notes</FormLabel><FormControl><Textarea className="h-32" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <DialogFooter>
                            <Button type="submit" disabled={createVisitMutation.isPending} className="min-w-[148px]">
                              {createVisitMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Visit Record"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-4">
                  {petData.visits.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-lg border border-dashed text-muted-foreground">No visits recorded yet. Add the first visit to start building this patient’s history.</div>
                  ) : (
                    [...petData.visits].sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()).map(visit => (
                      <Card key={visit.id} className="shadow-sm">
                        <CardHeader className="py-4 border-b bg-muted/5 flex flex-row items-center justify-between">
                          <div>
                            <div className="font-semibold text-lg">{visit.reason}</div>
                            <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3">
                              <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {formatDate(visit.visit_date)}</span>
                              {visit.vet_name && <span>• Dr. {visit.vet_name}</span>}
                              {visit.weight_lb && <span>• {visit.weight_lb} lbs</span>}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                          {visit.vaccines_administered?.length > 0 && (
                            <div>
                              <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Syringe className="w-3.5 h-3.5" /> Vaccines Administered</div>
                              <div className="flex flex-wrap gap-2">
                                {visit.vaccines_administered.map((v, i) => <Badge key={i} variant="secondary">{v}</Badge>)}
                              </div>
                            </div>
                          )}
                          {visit.meds_prescribed && (
                            <div>
                              <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-1">Medications</div>
                              <p className="text-sm bg-muted/30 p-2 rounded border border-border/50">{visit.meds_prescribed}</p>
                            </div>
                          )}
                          {visit.notes && (
                            <div>
                              <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Notes</div>
                              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{visit.notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="recalls" className="space-y-4 outline-none">
                <div className="flex justify-end">
                  <Dialog open={recallModalOpen} onOpenChange={setRecallModalOpen}>
                    <DialogTrigger asChild>
                      <Button className="shadow-sm w-full sm:w-auto"><Bell className="w-4 h-4 mr-2" /> Add Manual Recall</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Schedule Recall</DialogTitle></DialogHeader>
                      <Form {...recallForm}>
                        <form onSubmit={recallForm.handleSubmit(v => createRecallMutation.mutate(v))} className="space-y-4">
                          <FormField control={recallForm.control} name="recall_type" render={({ field }) => (
                            <FormItem><FormLabel>Recall Type / Vaccine</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={recallForm.control} name="due_date" render={({ field }) => (
                            <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={recallForm.control} name="notes" render={({ field }) => (
                            <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <DialogFooter>
                            <Button type="submit" disabled={createRecallMutation.isPending} className="min-w-[140px]">
                              {createRecallMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scheduling...</> : "Schedule Recall"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid gap-3">
                  {petData.recalls.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-lg border border-dashed text-muted-foreground">No active or past recalls. Add a reminder when preventive care is due.</div>
                  ) : (
                    [...petData.recalls].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).map(recall => {
                      const isOverdue = recall.status === 'overdue'
                      const isDone = recall.status === 'completed'
                      return (
                        <div key={recall.id} className={`p-4 rounded-lg border flex items-center justify-between ${isOverdue ? 'bg-destructive/5 border-destructive/20' : isDone ? 'bg-muted/30 border-border opacity-60' : 'bg-card'}`}>
                          <div className="flex gap-4 items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isOverdue ? 'bg-destructive/10 text-destructive' : isDone ? 'bg-muted text-muted-foreground' : 'bg-secondary/10 text-secondary'}`}>
                              <Bell className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-semibold flex items-center gap-2 text-foreground">
                                {recall.recall_type}
                                <Badge variant={
                                  isOverdue ? "destructive" :
                                  isDone ? "outline" :
                                  recall.status === 'due' ? "warning" : "default"
                                } className="text-[10px] px-1.5 py-0 uppercase">
                                  {recall.status}
                                </Badge>
                              </div>
                              <div className={`text-sm mt-0.5 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                Due: {formatDate(recall.due_date)}
                              </div>
                            </div>
                          </div>
                          {!isDone && (
                            <Button variant="outline" size="sm" onClick={() => updateRecallMutation.mutate({ id: recall.id, status: 'completed' })} className="shrink-0">
                              <CheckCircle className="w-4 h-4 mr-2" /> Mark Done
                            </Button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Shell>
  )
}
