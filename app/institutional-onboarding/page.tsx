"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerInstitution } from "@/services/auth"

const schema = z.object({
  name: z.string().min(2),
  subdomain: z.string().min(2).regex(/^[a-z0-9-]+$/),
  admin_name: z.string().min(2),
  admin_email: z.string().email(),
  admin_password: z.string().min(6),
  admin_phone: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function InstitutionalOnboardingPage() {
  const router = useRouter()
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      subdomain: "",
      admin_name: "",
      admin_email: "",
      admin_password: "",
      admin_phone: "",
    },
  })

  async function onSubmit(values: FormData) {
    try {
      await registerInstitution(values)
      toast.success("Institution registered successfully. Please login.")
      router.push("/auth/login")
    } catch {
      toast.error("Registration failed. Subdomain or email may already exist.")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Institution Onboarding</CardTitle>
          <CardDescription>
            Register your tuition center and create an administrator account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Institution Name</Label>
              <Input id="name" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input id="subdomain" placeholder="my-center" {...form.register("subdomain")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_name">Admin Full Name</Label>
              <Input id="admin_name" {...form.register("admin_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_email">Admin Email</Label>
              <Input id="admin_email" type="email" {...form.register("admin_email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_phone">Admin Phone</Label>
              <Input id="admin_phone" {...form.register("admin_phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_password">Admin Password</Label>
              <Input id="admin_password" type="password" {...form.register("admin_password")} />
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              Create Institution
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            <Link href="/auth/login" className="text-primary underline">
              Already registered? Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
