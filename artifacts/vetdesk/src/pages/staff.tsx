import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, ShieldCheck, Stethoscope, UserRound } from "lucide-react"

import { 
  addStaffMember,
  getClinicStaff,
  updateStaffMember,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { Staff } from "@/lib/types"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function StaffPage() {
  const { staff } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState("")

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
const [newStaffName, setNewStaffName] = useState("")
const [newStaffEmail, setNewStaffEmail] = useState("")
const [newStaffRole, setNewStaffRole] = useState("veterinarian")

  const clinicId = staff?.clinic_id

  const { data: staffMembers = [], isLoading } = useQuery({
    queryKey: ["clinic-staff", clinicId],
    queryFn: () => getClinicStaff(clinicId!),
    enabled: Boolean(clinicId),
  })

  const updateMutation = useMutation({
  mutationFn: ({
    staffId,
    updates,
  }: {
    staffId: number
    updates: {
      role?: string
      status?: "active" | "inactive"
    }
  }) => updateStaffMember(staffId, updates),

  onSuccess: async () => {
    await queryClient.invalidateQueries({
      queryKey: ["clinic-staff", clinicId],
    })

    toast({
      title: "Staff member updated",
      description: "The changes were saved successfully.",
    })
  },

  onError: (error: any) => {
    const message =
      error?.message ||
      error?.details ||
      error?.hint ||
      "Unknown error occurred"

    toast({
      title: "Could not update staff member",
      description: message,
      variant: "destructive",
    })
  },
})

const addMutation = useMutation({
  mutationFn: () =>
    addStaffMember({
      clinic_id: clinicId!,
      name: newStaffName.trim(),
      email: newStaffEmail.trim().toLowerCase(),
      role: newStaffRole,
    }),

  onSuccess: async () => {
    await queryClient.invalidateQueries({
      queryKey: ["clinic-staff", clinicId],
    })

    await queryClient.refetchQueries({
      queryKey: ["clinic-staff", clinicId],
    })

    setNewStaffName("")
    setNewStaffEmail("")
    setNewStaffRole("veterinarian")
    setIsAddDialogOpen(false)

    toast({
      title: "Staff member added",
      description: "The new staff member was added successfully.",
    })
  },

  onError: (error: any) => {
    console.error("ADD STAFF ERROR:", error)

    const message =
      error?.message ||
      error?.details ||
      error?.hint ||
      "Unknown error occurred"

    alert(`Add staff failed: ${message}`)

    toast({
      title: "Could not add staff member",
      description: message,
      variant: "destructive",
    })
  },
})
   const handleAddStaff = () => {
  addMutation.mutate()
}

  const filteredStaff = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
   
    if (!normalizedSearch) {
      return staffMembers
    }

    return staffMembers.filter((member) => {
      return (
        member.name?.toLowerCase().includes(normalizedSearch) ||
        member.email?.toLowerCase().includes(normalizedSearch) ||
        member.role?.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [search, staffMembers])

  function getRoleIcon(role: string) {
    if (role === "admin") {
      return <ShieldCheck className="h-4 w-4" />
    }

    if (role === "veterinarian") {
      return <Stethoscope className="h-4 w-4" />
    }

    return <UserRound className="h-4 w-4" />
  }

  function formatRole(role: string) {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  if (!clinicId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            Clinic information could not be found.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-3xl font-bold tracking-tight">
      Staff Management
    </h1>

    <p className="text-muted-foreground">
      Manage clinic employees, roles and account statuses.
    </p>
  </div>

  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
    <DialogTrigger asChild>
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        Add Staff Member
      </Button>
    </DialogTrigger>

    <DialogContent className="sm:max-w-md">
      <form onSubmit={handleAddStaff}>
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>

          <DialogDescription>
            Add a new employee to the clinic. Their initial status will
            be pending.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-5">
          <div className="grid gap-2">
            <Label htmlFor="staff-name">Full name</Label>

            <Input
              id="staff-name"
              value={newStaffName}
              onChange={(event) => setNewStaffName(event.target.value)}
              placeholder="Dr. Sarah Johnson"
              autoComplete="name"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-email">Email address</Label>

            <Input
              id="staff-email"
              type="email"
              value={newStaffEmail}
              onChange={(event) => setNewStaffEmail(event.target.value)}
              placeholder="sarah@clinic.com"
              autoComplete="email"
            />
          </div>

          <div className="grid gap-2">
            <Label>Role</Label>

            <Select
              value={newStaffRole}
              onValueChange={setNewStaffRole}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>

                <SelectItem value="veterinarian">
                  Veterinarian
                </SelectItem>

                <SelectItem value="receptionist">
                  Receptionist
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAddDialogOpen(false)}
            disabled={addMutation.isPending}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={addMutation.isPending}>
            {addMutation.isPending ? "Adding..." : "Add Staff"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Clinic Staff</CardTitle>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search staff..."
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              Loading staff...
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No staff members found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredStaff.map((member: Staff) => {
                    const isCurrentUser = member.id === staff?.id

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                              {getRoleIcon(member.role)}
                            </div>

                            <div>
                              <div className="font-medium">
                                {member.name || "Unnamed staff member"}
                              </div>

                              <div className="text-sm text-muted-foreground">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Select
                            value={member.role}
                            disabled={
                              isCurrentUser || updateMutation.isPending
                            }
                            onValueChange={(role) =>
                              updateMutation.mutate({
                                staffId: member.id,
                                updates: { role },
                              })
                            }
                          >
                            <SelectTrigger className="w-44">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="veterinarian">
                                Veterinarian
                              </SelectItem>
                              <SelectItem value="receptionist">
                                Receptionist
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              member.status === "active"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {member.status === "active"
                              ? "Active"
                              : "Inactive"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant={
                              member.status === "active"
                                ? "outline"
                                : "default"
                            }
                            disabled={
                              isCurrentUser || updateMutation.isPending
                            }
                            onClick={() =>
                              updateMutation.mutate({
                                staffId: member.id,
                                updates: {
                                  status:
                                    member.status === "active"
                                      ? "inactive"
                                      : "active",
                                },
                              })
                            }
                          >
                            {member.status === "active"
                              ? "Deactivate"
                              : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
