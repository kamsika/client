"use client"

import { SuperAdminDashboard } from "@/components/super-admin-dashboard"

/**
 * Super Admin lives on the main domain (example.com/superadmin).
 * The existing /admin/dashboard entry point still works for backward compatibility.
 */
export default function SuperAdminPage() {
  return <SuperAdminDashboard />
}
