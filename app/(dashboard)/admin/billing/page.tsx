"use client"

import { useEffect, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { DashboardShell } from "@/components/dashboard-shell"
import { LogsTable } from "@/components/logs-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStoredUser } from "@/lib/api-client"
import { getAdminNav } from "@/lib/admin-nav"
import { getBilling, listInstitutions } from "@/services/institution"
import type { BillingRecord, Institution, User } from "@/types"

export default function AdminBillingPage() {
  const user = getStoredUser<User>()
  const isSuperAdmin = user?.role === "super_admin"

  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<number | null>(
    user?.institution_id ?? null
  )
  const [billing, setBilling] = useState<BillingRecord[]>([])

  useEffect(() => {
    if (isSuperAdmin) {
      listInstitutions()
        .then((data) => {
          setInstitutions(data)
          if (data.length > 0 && !selectedInstitutionId) {
            setSelectedInstitutionId(data[0].id)
          }
        })
        .catch(() => toast.error("Failed to load institutions"))
    }
  }, [isSuperAdmin, selectedInstitutionId])

  useEffect(() => {
    if (selectedInstitutionId) loadData(selectedInstitutionId)
  }, [selectedInstitutionId])

  async function loadData(institutionId: number) {
    try {
      const [billingData] = await Promise.all([getBilling(institutionId)])
      setBilling(billingData)
    } catch {
      toast.error("Failed to load billing data")
    }
  }

  const billingColumns: ColumnDef<BillingRecord>[] = [
    { accessorKey: "billing_period", header: "Period" },
    { accessorKey: "saas_flat_fee", header: "SaaS Fee", cell: ({ row }) => `$${row.original.saas_flat_fee.toFixed(2)}` },
    { accessorKey: "sms_count", header: "SMS Count" },
    { accessorKey: "sms_unit_price", header: "SMS Unit Price", cell: ({ row }) => `$${row.original.sms_unit_price.toFixed(2)}` },
    { accessorKey: "total_amount_due", header: "Total Due", cell: ({ row }) => `$${row.original.total_amount_due.toFixed(2)}` },
    { accessorKey: "payment_status", header: "Status" },
  ]

  const current = billing[0]

  return (
    <DashboardShell title="Billing" navItems={getAdminNav(isSuperAdmin)} allowedRoles={["institution_admin", "super_admin"]}>
      <div className="grid gap-6">
        {isSuperAdmin && institutions.length > 0 && (
          <Select
            value={String(selectedInstitutionId ?? "")}
            onValueChange={(v) => v && setSelectedInstitutionId(Number(v))}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select institution" />
            </SelectTrigger>
            <SelectContent>
              {institutions.map((inst) => (
                <SelectItem key={inst.id} value={String(inst.id)}>
                  {inst.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {current && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Flat SaaS Fee</CardDescription>
                <CardTitle>${current.saas_flat_fee.toFixed(2)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>SMS Usage</CardDescription>
                <CardTitle>{current.sms_count}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>SMS Unit Price</CardDescription>
                <CardTitle>${current.sms_unit_price.toFixed(2)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Total Amount Due</CardDescription>
                <CardTitle>${current.total_amount_due.toFixed(2)}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Billing Records</CardTitle>
            <CardDescription>Hybrid flat-rate SaaS + pay-per-SMS usage</CardDescription>
          </CardHeader>
          <CardContent>
            <LogsTable data={billing} columns={billingColumns} emptyMessage="No billing records yet." />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
