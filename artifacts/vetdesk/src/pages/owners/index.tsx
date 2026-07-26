import { useState, useMemo } from "react"
import { Shell } from "@/components/layout/Shell"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listOwnersWithPets, createOwner } from "@/lib/api"
import { capitalize } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/ui/empty-state"
import { useDebounce } from "@/hooks/use-debounce"
import { formatDate } from "@/lib/format"
import { Link, useLocation } from "wouter"
import { Search, Plus, Loader as Loader2, ChevronRight, User, PawPrint } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/components/ui/use-toast"
import type { OwnerWithPets } from "@/lib/types"

const ownerSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  phone: z.string().trim().min(1, "Phone is required"),
  email: z.union([z.string().trim().email("Please enter a valid email address"), z.literal("")]).optional(),
  address: z.string().optional(),
})

export default function OwnersList() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: ownersWithPets, isLoading } = useQuery({
    queryKey: ["owners-with-pets"],
    queryFn: () => listOwnersWithPets(),
  })

  const filteredOwners = useMemo(() => {
    if (!ownersWithPets) return []
    if (!debouncedSearch.trim()) return ownersWithPets

    const searchLower = debouncedSearch.toLowerCase()
    return ownersWithPets.filter((owner) => {
      const matchesOwner =
        owner.first_name.toLowerCase().includes(searchLower) ||
        owner.last_name.toLowerCase().includes(searchLower) ||
        (owner.email && owner.email.toLowerCase().includes(searchLower)) ||
        owner.phone.includes(searchLower)

      const matchesPet = owner.pets.some((pet) =>
        pet.name.toLowerCase().includes(searchLower)
      )

      return matchesOwner || matchesPet
    })
  }, [ownersWithPets, debouncedSearch])

  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof ownerSchema>) =>
      createOwner({
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone,
        email: values.email || null,
        address: values.address || null,
      }),
    onSuccess: (newOwner) => {
      toast({ title: "Owner created successfully" })
      queryClient.invalidateQueries({ queryKey: ["owners-with-pets"] })
      setCreateOpen(false)
      form.reset()
      setLocation(`/owners/${newOwner.id}`)
    },
    onError: (err: any) => {
      toast({ title: "Failed to create owner", description: err.message, variant: "destructive" })
    },
  })

  const form = useForm<z.infer<typeof ownerSchema>>({
    resolver: zodResolver(ownerSchema),
    defaultValues: { first_name: "", last_name: "", phone: "", email: "", address: "" },
  })

  function onSubmit(values: z.infer<typeof ownerSchema>) {
    createMutation.mutate({
      ...values,
      first_name: capitalize(values.first_name),
      last_name: capitalize(values.last_name),
      email: values.email || undefined,
      address: values.address || undefined,
    })
  }

  return (
    <Shell>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Owners & Pets</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">Search the clinic database and keep owner and patient records easy to navigate.</p>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0 shadow-sm w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                New Owner
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Owner</DialogTitle>
                <DialogDescription>Create a new client record.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="first_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="last_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input type="tel" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl><Input type="email" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address (Optional)</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending} className="min-w-[128px]">
                      {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Owner"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="overflow-hidden shadow-sm border-border/60">
          <div className="p-4 sm:p-5 border-b bg-muted/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or pet name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background h-11"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {debouncedSearch ? `Showing ${filteredOwners.length} result${filteredOwners.length === 1 ? "" : "s"}` : "Browse all clients"}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-10 flex justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : !ownersWithPets || ownersWithPets.length === 0 ? (
            <div className="p-8 sm:p-10">
              <EmptyState
                title="No owners yet"
                description="Get started by adding your first client."
                action={<Button variant="outline" onClick={() => setCreateOpen(true)}>Add first owner</Button>}
              />
            </div>
          ) : filteredOwners.length === 0 ? (
            <div className="p-8 sm:p-10">
              <EmptyState
                title="No matches found"
                description={`No results match "${debouncedSearch}". Try a different search term.`}
              />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Pets</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOwners.map(owner => (
                      <TableRow key={owner.id} className="cursor-pointer group" onClick={() => setLocation(`/owners/${owner.id}`)}>
                        <TableCell>
                          <div className="font-semibold text-foreground flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            {owner.last_name}, {owner.first_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{owner.phone}</div>
                            {owner.email && <div className="text-muted-foreground text-xs">{owner.email}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {owner.pets.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {owner.pets.slice(0, 3).map(pet => (
                                  <span key={pet.id} className="inline-flex items-center gap-1 text-xs bg-muted/50 px-2 py-0.5 rounded-full">
                                    <PawPrint className="w-3 h-3" />
                                    {pet.name}
                                  </span>
                                ))}
                                {owner.pets.length > 3 && (
                                  <span className="text-xs text-muted-foreground">+{owner.pets.length - 3}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">No pets</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(owner.created_at)}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden divide-y">
                {filteredOwners.map(owner => (
                  <button
                    key={owner.id}
                    type="button"
                    className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/20"
                    onClick={() => setLocation(`/owners/${owner.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{owner.first_name} {owner.last_name}</div>
                        <div className="text-sm text-muted-foreground">{owner.phone}</div>
                        {owner.pets.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {owner.pets.slice(0, 2).map(pet => (
                              <span key={pet.id} className="inline-flex items-center gap-1 text-xs bg-muted/50 px-2 py-0.5 rounded-full">
                                <PawPrint className="w-3 h-3" />
                                {pet.name}
                              </span>
                            ))}
                            {owner.pets.length > 2 && (
                              <span className="text-xs text-muted-foreground">+{owner.pets.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </Shell>
  )
}
