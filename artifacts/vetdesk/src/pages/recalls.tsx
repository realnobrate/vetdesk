import { useState } from "react"
import { Shell } from "@/components/layout/Shell"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listRecalls, updateRecall } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import { CircleCheck as CheckCircle, Mail } from "lucide-react"
import { Link, useSearch } from "wouter"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

const VALID_STATUSES = ["upcoming", "due", "overdue", "sent", "completed"]

export default function RecallsList() {
  const search = useSearch()
  const initialStatus = new URLSearchParams(search).get("status")
  const [statusFilter, setStatusFilter] = useState<string>(
    initialStatus && VALID_STATUSES.includes(initialStatus) ? initialStatus : "all"
  )
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: recalls, isLoading, isError } = useQuery({
    queryKey: ["recalls", statusFilter],
    queryFn: () => listRecalls(statusFilter !== "all" ? { status: statusFilter } : undefined),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "sent" | "completed" }) =>
      updateRecall(id, { status }),
    onSuccess: (_, { status }) => {
      toast({ title: `Recall marked as ${status}` })
      queryClient.invalidateQueries({ queryKey: ["recalls"] })
    },
  })

  return (
    <Shell>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Recalls</h1>
            <p className="mt-1 text-muted-foreground">Track preventative care and vaccine reminders with a clear, action-focused view.</p>
          </div>
          <div className="w-[200px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="due">Due Now</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="sent">Notice Sent</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/10">
                <TableHead>Type</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Owner Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-destructive">Failed to load recalls. Please try again.</TableCell></TableRow>
              ) : !recalls || recalls.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No recalls found.</TableCell></TableRow>
              ) : (
                recalls.map(recall => {
                  const isOverdue = recall.status === 'overdue'
                  return (
                    <TableRow key={recall.id}>
                      <TableCell className="font-semibold text-foreground">{recall.recall_type}</TableCell>
                      <TableCell className={isOverdue ? 'text-destructive font-bold' : ''}>
                        {formatDate(recall.due_date)}
                      </TableCell>
                      <TableCell>
                        <Link href={`/pets/${recall.pet_id}`} className="font-medium text-primary hover:underline">
                          {recall.pet.name}
                        </Link>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">{recall.pet.species}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <Link href={`/owners/${recall.owner.id}`} className="font-medium hover:text-primary transition-colors">
                            {recall.owner.first_name} {recall.owner.last_name}
                          </Link>
                          <div className="text-muted-foreground text-xs">{recall.owner.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          isOverdue ? "destructive" :
                          recall.status === 'completed' ? "outline" :
                          recall.status === 'sent' ? "secondary" : "default"
                        } className="uppercase text-[10px]">
                          {recall.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {recall.status !== 'completed' && (
                          <>
                            {recall.status !== 'sent' && (
                              <Button variant="outline" size="sm"
                                onClick={() => updateMutation.mutate({ id: recall.id, status: "sent" })}
                                className="h-8">
                                <Mail className="w-3.5 h-3.5 mr-1" /> Send
                              </Button>
                            )}
                            <Button size="sm"
                              onClick={() => updateMutation.mutate({ id: recall.id, status: "completed" })}
                              className="h-8 shadow-sm">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Done
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </Shell>
  )
}
