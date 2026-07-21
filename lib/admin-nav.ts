export function getAdminNav(isSuperAdmin: boolean) {
  const items = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/billing", label: "Billing" },
  ]
  if (!isSuperAdmin) {
    items.push(
      { href: "/admin/sms-logs", label: "SMS Logs" },
      { href: "/admin/students/import", label: "Import Students" },
    )
  }
  return items
}
