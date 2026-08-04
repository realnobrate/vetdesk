import { useState, useEffect } from "react"
import { Shell } from "@/components/layout/Shell"
import { useParams, Link, useLocation } from "wouter"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getOwner, updateOwner, deleteOwner, createPet, deletePet } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/format"
import { ArrowLeft, User, Phone, Mail, MapPin, Plus, PawPrint, Loader as Loader2, Save } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth"

const petSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  species: z.enum(["dog", "cat", "other"]),
  breed: z.string().optional().or(z.literal("")),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  birth_date: z.string().optional().or(z.literal("")),
  weight_lb: z.union([z.coerce.number().positive("Weight must be positive"), z.literal("")]).optional(),
  notes: z.string().optional().or(z.literal("")),
})

export default function OwnerDetail() {

  const capitalize = (text: string) =>
    text
      .trim()
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

  const { id } = useParams()
  const ownerId = Number(id)
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { staff } = useAuth()
  const queryClient = useQueryClient()

  const { data: owner, isLoading } = useQuery({
    queryKey: ["owner", ownerId],
    queryFn: () => getOwner(ownerId),
    enabled: !!ownerId,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateOwner>[1]) => updateOwner(ownerId, data),
    onSuccess: () => {
      setIsEditing(false)
      toast({ title: "Owner updated" })
      queryClient.invalidateQueries({ queryKey: ["owner", ownerId] })
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteOwner(ownerId),
    onSuccess: () => {
      toast({ title: "Owner archived" })
      queryClient.invalidateQueries({ queryKey: ["owners"] })
      setLocation("/owners")
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  })

  const createPetMutation = useMutation({
    mutationFn: (values: z.infer<typeof petSchema>) =>
      createPet({
        owner_id: ownerId,
        name: capitalize(values.name),
        species: values.species,
        breed: values.breed || null,
        sex: values.sex || "unknown",
        birth_date: values.birth_date || null,
        weight_lb: values.weight_lb ? Number(values.weight_lb) : null,
        notes: values.notes || null,
      }),
    onSuccess: (newPet) => {
      toast({ title: "Pet added successfully" })
      setPetModalOpen(false)
      petForm.reset()
      queryClient.invalidateQueries({ queryKey: ["owner", ownerId] })
      setLocation(`/pets/${newPet.id}`)
    },
    onError: (err: any) => toast({ title: "Failed to add pet", description: err.message, variant: "destructive" }),
  })
  const deletePetMutation = useMutation({
    mutationFn: (petId: number) => deletePet(petId),
  
    onSuccess: () => {
      toast({
        title: "Pet archived successfully",
      })
  
      queryClient.invalidateQueries({
        queryKey: ["owner", ownerId],
      })
    },
  
    onError: (err: any) => {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive",
      })
    },
  })

  const [isEditing, setIsEditing] = useState(false)
  const [petModalOpen, setPetModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [petDeleteTarget, setPetDeleteTarget] = useState<null | { id: number; name: string }>(null)

  const [editData, setEditData] = useState({
    first_name: "", last_name: "", phone: "", email: "", address: ""
  })

  useEffect(() => {
    if (owner && !isEditing) {
      setEditData({
        first_name: owner.first_name,
        last_name: owner.last_name,
        phone: owner.phone,
        email: owner.email || "",
        address: owner.address || "",
      })
    }
  }, [owner, isEditing])

  const isEditValid = editData.first_name.trim().length > 0 && editData.last_name.trim().length > 0 && editData.phone.trim().length > 0

  const petForm = useForm<z.infer<typeof petSchema>>({
    resolver: zodResolver(petSchema),
    defaultValues: { name: "", species: "dog", breed: "", sex: "unknown", birth_date: "", weight_lb: "" as any, notes: "" },
  })

  if (isLoading) return <Shell><div className="p-8 flex justify-center"><Loader2 className="animate-spin text-muted-foreground w-8 h-8" /></div></Shell>
  if (!owner) return <Shell><div className="p-8 text-center text-muted-foreground">Owner not found.</div></Shell>

  return (
    <Shell>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/owners" className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Owners
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {owner.first_name} {owner.last_name}
                </h1>
                <div className="mt-1 text-sm font-medium text-muted-foreground">
                  Client record • joined {formatDate(owner.created_at)}
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {staff?.role === "admin" ? <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto text-destructive border-destructive/20 hover:bg-destructive/10">Delete</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Owner</DialogTitle>
                    <DialogDescription>
                      Archive {owner.first_name} {owner.last_name} and all linked pets? Medical history is retained for audit and can be restored by an administrator.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Archive client
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog> : null}
              <Button onClick={() => setIsEditing(!isEditing)} variant={isEditing ? "outline" : "default"} className="w-full sm:w-auto">
                {isEditing ? "Cancel Edit" : "Edit Details"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Details */}
          <Card className="lg:col-span-1 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg flex justify-between items-center">
                Contact Info
                {isEditing && (
                  <Button size="sm" onClick={() => updateMutation.mutate({
                    first_name: editData.first_name,
                    last_name: editData.last_name,
                    phone: editData.phone,
                    email: editData.email || null,
                    address: editData.address || null,
                  })} disabled={updateMutation.isPending || !isEditValid}>
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>First *</Label>
                      <Input value={editData.first_name} onChange={e => setEditData({ ...editData, first_name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Last *</Label>
                      <Input value={editData.last_name} onChange={e => setEditData({ ...editData, last_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Phone *</Label>
                    <Input value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Address</Label>
                    <Input value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">{owner.phone}</div>
                      <div className="text-xs text-muted-foreground">Mobile</div>
                    </div>
                  </div>
                  {owner.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="font-medium">{owner.email}</div>
                    </div>
                  )}
                  {owner.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="font-medium">{owner.address}</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pets List */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Pets</CardTitle>
                <Dialog open={petModalOpen} onOpenChange={setPetModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="shadow-sm w-full sm:w-auto">
                      <Plus className="w-4 h-4 mr-1" /> Add Pet
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Pet</DialogTitle>
                      <DialogDescription>Add a new patient under this owner.</DialogDescription>
                    </DialogHeader>
                    <Form {...petForm}>
                      <form onSubmit={petForm.handleSubmit(v => createPetMutation.mutate({...v, name: capitalize(v.name)}))} className="space-y-4">
                        <FormField control={petForm.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={petForm.control} name="species" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Species</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="dog">Dog</SelectItem>
                                  <SelectItem value="cat">Cat</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={petForm.control} name="breed" render={({ field }) => (
                            <FormItem><FormLabel>Breed</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={petForm.control} name="sex" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sex</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                  <SelectItem value="unknown">Unknown</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={petForm.control} name="birth_date" render={({ field }) => (
                            <FormItem><FormLabel>Birth Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <FormField control={petForm.control} name="weight_lb" render={({ field }) => (
                          <FormItem><FormLabel>Weight (lbs)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <DialogFooter className="pt-4">
                          <Button type="button" variant="outline" onClick={() => setPetModalOpen(false)}>Cancel</Button>
                          <Button type="submit" disabled={createPetMutation.isPending} className="min-w-[112px]">
                            {createPetMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Pet"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {owner.pets.length === 0 ? (
                  <div className="p-10 sm:p-12 text-center text-muted-foreground">
                    <PawPrint className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="font-medium text-foreground">No pets recorded</p>
                    <p className="text-sm mt-1 mb-4">This client doesn't have any pets yet.</p>
                    <Button variant="outline" onClick={() => setPetModalOpen(true)}>Add First Pet</Button>
                  </div>
                ) : (
                  owner.pets.map(pet => (
                    <div key={pet.id} className="p-4 sm:p-5 hover:bg-muted/10 transition-colors flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                      <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center overflow-hidden shrink-0">
  {pet.photo_url ? (
    <img
      src={pet.photo_url}
      alt={pet.name}
      className="w-full h-full object-cover"
    />
  ) : (
    <PawPrint className="w-6 h-6" />
  )}
</div>
                        <div>
                          <div className="font-semibold text-lg hover:text-primary transition-colors">
                            <Link href={`/pets/${pet.id}`}>{pet.name}</Link>
                          </div>
                          <div className="text-sm text-muted-foreground capitalize flex flex-wrap items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider">{pet.species}</Badge>
                            {pet.breed && <span>{pet.breed}</span>}
                            {pet.sex !== 'unknown' && <span>• {pet.sex}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Link href={`/pets/${pet.id}`}>
                          <Button variant="outline" className="w-full sm:w-auto">View</Button>
                        </Link>

                        {staff?.role === "admin" ? <Dialog open={petDeleteTarget?.id === pet.id} onOpenChange={(open) => setPetDeleteTarget(open ? { id: pet.id, name: pet.name } : null)}>
                          <DialogTrigger asChild>
                            <Button type="button" variant="destructive" size="sm" className="w-full sm:w-auto" disabled={deletePetMutation.isPending}>
                              {deletePetMutation.isPending ? "Archiving..." : "Archive"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Archive pet?</DialogTitle>
                              <DialogDescription>Archive {pet.name}? Medical history remains retained and auditable.</DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setPetDeleteTarget(null)}>Cancel</Button>
                              <Button variant="destructive" onClick={() => { deletePetMutation.mutate(pet.id); setPetDeleteTarget(null) }}>Archive pet</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog> : null}
                      </div>
                    </div>
                  ))
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </Shell>
)
}
