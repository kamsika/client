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
import { getApiErrorMessage } from "@/lib/api-errors"
import { parentLogin } from "@/services/parent"

const schema = z.object({
  phone_number: z
    .string()
    .trim()
    .min(6, "Enter your registered phone number"),
  password: z.string().min(1, "Password is required"),
})

type FormData = z.infer<typeof schema>

export default function ParentLoginPage() {
  const router = useRouter()
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone_number: "", password: "" },
  })

  async function onSubmit(values: FormData) {
    try {
      await parentLogin(values.phone_number.trim(), values.password)
      toast.success("Login successful")
      router.replace("/parent/dashboard")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Invalid phone number or password"))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Parent Sign In</CardTitle>
          <CardDescription>
            Log in with your registered phone number to view your child&apos;s attendance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="e.g. 0771234567"
                {...form.register("phone_number")}
              />
              {form.formState.errors.phone_number && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.phone_number.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <div className="text-muted-foreground mt-4 space-y-2 text-center text-sm">
            <p>
              <Link href="/auth/login" className="text-primary underline">
                Staff login (email)
              </Link>
            </p>
            <p>
              <Link href="/" className="underline">
                Back to home
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
