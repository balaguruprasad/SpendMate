"use client";

/**
 * User form — react-hook-form + zodResolver. Two modes:
 *
 *  - CREATE: name, email, Role select (Admin / Cardholder), and an initial
 *    password (the user's first password — admin-set, hashed server-side).
 *  - EDIT: name, Role select, active Switch. No email or password
 *    (identity/credentials are not editable here).
 *
 * Inline format errors come from the resolver; server errors (e.g. duplicate
 * email) surface from the mutation hook via a toast.
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { USER_ROLES, type UserAccount, type UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/shared/password-input";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABEL } from "@/lib/config/navigation";
import {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateValues,
  type UserUpdateValues,
} from "../schemas";
import { useCreateUser, useUpdateUser } from "../hooks/use-users";

interface CreateModeProps {
  mode?: "create";
  user?: undefined;
  onDone?: () => void;
}

interface EditModeProps {
  mode: "edit";
  user: UserAccount;
  onDone?: () => void;
}

type UserFormProps = CreateModeProps | EditModeProps;

const CREATE_DEFAULTS: UserCreateValues = {
  name: "",
  email: "",
  role: "MEMBER",
  password: "",
};

export function UserForm(props: UserFormProps) {
  return props.mode === "edit" ? (
    <EditForm user={props.user} onDone={props.onDone} />
  ) : (
    <CreateForm onDone={props.onDone} />
  );
}

/** Role select shared by both modes. */
function RoleField({
  role,
  onRoleChange,
  roleError,
}: {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  roleError?: { message?: string };
}) {
  return (
    <Field>
      <FieldLabel htmlFor="user-role">Role</FieldLabel>
      <Select value={role} onValueChange={(value) => onRoleChange(value as UserRole)}>
        <SelectTrigger id="user-role" className="w-full">
          <SelectValue placeholder="Select a role" />
        </SelectTrigger>
        <SelectContent>
          {USER_ROLES.map((value) => (
            <SelectItem key={value} value={value}>
              {ROLE_LABEL[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>
        Cardholders see and complete their own charges; admins import statements
        and manage everything.
      </FieldDescription>
      <FieldError errors={roleError ? [roleError] : undefined} />
    </Field>
  );
}

function CreateForm({ onDone }: { onDone?: () => void }) {
  const createUser = useCreateUser();
  const form = useForm<UserCreateValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: CREATE_DEFAULTS,
    mode: "onBlur",
  });
  const { register, handleSubmit, setValue, watch, formState } = form;
  const role = watch("role");
  const errors = formState.errors;

  async function onSubmit(values: UserCreateValues) {
    await createUser.mutateAsync({
      name: values.name,
      email: values.email,
      role: values.role,
      password: values.password,
    });
    form.reset(CREATE_DEFAULTS);
    onDone?.();
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="user-name">Full name</FieldLabel>
          <Input id="user-name" {...register("name")} aria-invalid={!!errors.name} />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="user-email">Email</FieldLabel>
          <Input
            id="user-email"
            type="email"
            {...register("email")}
            aria-invalid={!!errors.email}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <RoleField
          role={role}
          onRoleChange={(value) => setValue("role", value, { shouldValidate: true })}
          roleError={errors.role}
        />

        <Field>
          <FieldLabel htmlFor="user-password">Initial password</FieldLabel>
          <PasswordInput
            id="user-password"
            autoComplete="new-password"
            {...register("password")}
            aria-invalid={!!errors.password}
          />
          <FieldDescription>
            The user&apos;s first password — they can change it after signing in.
          </FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" loading={createUser.isPending}>
          Add user
        </Button>
      </div>
    </form>
  );
}

function EditForm({ user, onDone }: { user: UserAccount; onDone?: () => void }) {
  const updateUser = useUpdateUser();
  const form = useForm<UserUpdateValues>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
    mode: "onBlur",
  });
  const { register, handleSubmit, setValue, watch, formState } = form;
  const role = watch("role");
  const isActive = watch("isActive");
  const errors = formState.errors;

  async function onSubmit(values: UserUpdateValues) {
    await updateUser.mutateAsync({
      id: user.id,
      patch: {
        name: values.name,
        role: values.role,
        isActive: values.isActive,
      },
    });
    onDone?.();
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="user-name">Full name</FieldLabel>
          <Input id="user-name" {...register("name")} aria-invalid={!!errors.name} />
          <FieldError errors={[errors.name]} />
        </Field>

        <RoleField
          role={role}
          onRoleChange={(value) => setValue("role", value, { shouldValidate: true })}
          roleError={errors.role}
        />

        <Field orientation="horizontal">
          <Switch
            id="user-active"
            checked={isActive}
            onCheckedChange={(checked) =>
              setValue("isActive", checked, { shouldValidate: true })
            }
          />
          <FieldLabel htmlFor="user-active">Active</FieldLabel>
        </Field>
      </FieldGroup>

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" loading={updateUser.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
