"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Mail, TriangleAlert } from "lucide-react";

import { LogoMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useSession } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/http-error";
import { toast } from "@/lib/toast";
import { ROLE_BASE } from "@/lib/constants";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.fullName.split(" ")[0]}`);
      router.replace(`${ROLE_BASE[user.role]}/charges`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? "Invalid email or password"
          : "Something went wrong. Please try again.";
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center gap-7">
        <LogoMark className="size-10" />

        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-light tracking-tight text-foreground">
            Welcome <span className="font-semibold">back</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue to the SpendMate portal.
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="flex w-full items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            <TriangleAlert className="size-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex w-full flex-col gap-5"
        >
          {/* Email */}
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Mail />
              </InputGroupAddon>
              <InputGroupInput
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@mesaschool.co"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
            </InputGroup>
            <FieldError errors={[errors.email]} />
          </Field>

          {/* Password with eye toggle */}
          <Field data-invalid={!!errors.password}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <button
                type="button"
                onClick={() =>
                  toast.message(
                    "Contact your administrator to reset your password.",
                  )
                }
                className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <InputGroup>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[errors.password]} />
          </Field>

          {/* Submit — spinner loading state, never opacity-faded */}
          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            className="mt-1 w-full text-sm font-semibold tracking-wide"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
