import Link from "next/link"
import { ArrowRight, Bell, BarChart3, Users, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <p className="text-lg font-semibold">Classroom Management Platform</p>
          <div className="flex gap-2">
            <Link href="/auth/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="/institutional-onboarding">
              <Button>Register Institution</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">
            Multi-tenant classroom management for tuition centers
          </h1>
          <p className="text-muted-foreground text-lg">
            Real-time attendance tracking, automated parent SMS alerts, study habit monitoring,
            and hybrid SaaS billing for academic institutes.
          </p>
          <div className="flex gap-3">
            <Link href="/auth/login">
              <Button size="lg">
                Get Started
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/institutional-onboarding">
              <Button size="lg" variant="outline">
                Onboard Institution
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-muted/40 border-y py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <Clock className="text-primary mb-2 size-8" />
              <CardTitle className="text-base">Real-Time Attendance</CardTitle>
              <CardDescription>Teachers mark presence with instant server sync.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Bell className="text-primary mb-2 size-8" />
              <CardTitle className="text-base">Automated SMS Alerts</CardTitle>
              <CardDescription>Late and absent notifications sent to parents automatically.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <BarChart3 className="text-primary mb-2 size-8" />
              <CardTitle className="text-base">Study Analytics</CardTitle>
              <CardDescription>Line charts tracking student preparation sessions over time.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Users className="text-primary mb-2 size-8" />
              <CardTitle className="text-base">Multi-Tenant RBAC</CardTitle>
              <CardDescription>Isolated data spaces for each institution with role-based access.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Dynamic portals for every stakeholder in your tuition center.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["Super Admin", "Platform oversight, institution activation, global billing"],
              ["Institution Admin", "Center setup, class creation, student imports, billing"],
              ["Teacher", "Live attendance dashboard and classroom management"],
              ["Student", "Study timer, homework tracking, performance charts"],
              ["Parent", "Arrival logs, absence metrics, and alert history"],
            ].map(([role, desc]) => (
              <div key={role} className="rounded-lg border p-4">
                <p className="font-medium">{role}</p>
                <p className="text-muted-foreground text-sm">{desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
