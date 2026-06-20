"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/services/auth.service";
import { loginSchema } from "@/lib/validators";
import { ROLE_HOME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { z } from "zod";

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, isAuthenticated, user } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [isAuthenticated, user, router]);

  React.useEffect(() => {
    if (searchParams.get("expired") === "1") {
      toast.error("Your session has expired. Please sign in again.");
    }
  }, [searchParams]);

  const onSubmit = async (data: LoginForm) => {
    try {
      const { token, user: loggedInUser } = await authService.login(data);
      setSession(token, loggedInUser);

      if (loggedInUser.force_password_change) {
        router.push("/change-password");
        return;
      }

      toast.success(`Welcome back, ${loggedInUser.name.split(" ")[0]}!`);
      router.push(ROLE_HOME[loggedInUser.role]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      const fieldErrors = axiosErr.response?.data?.errors;
      if (fieldErrors?.file_number) {
        setError("file_number", { message: fieldErrors.file_number[0] });
      } else {
        toast.error(axiosErr.response?.data?.message ?? "Login failed. Please try again.");
      }
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Staff Sign In</CardTitle>
        <CardDescription>Enter your file number and password to access the CBT portal.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="file_number">
              File Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="file_number"
              type="text"
              autoComplete="username"
              placeholder="e.g. ADMIN/0001"
              aria-describedby={errors.file_number ? "file_number_error" : undefined}
              {...register("file_number")}
            />
            {errors.file_number && (
              <p id="file_number_error" className="text-sm text-red-600 flex items-center gap-1">
                <span aria-hidden="true">!</span> {errors.file_number.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">
              Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="pr-10"
                aria-describedby={errors.password ? "password_error" : undefined}
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p id="password_error" className="text-sm text-red-600 flex items-center gap-1">
                <span aria-hidden="true">!</span> {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {isSubmitting ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
