"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { KeyRound, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/backstore/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createUser, resetPassword, setUserRole } from "./actions";

type Role = "USER" | "ADMIN";
type UserRow = { id: string; email: string; name: string | null; role: Role; createdAt: string };

const ROLE_LABEL: Record<Role, string> = { USER: "User", ADMIN: "Admin" };

function RoleSelect({ user, disabled }: { user: UserRow; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={user.role}
      disabled={disabled || pending}
      onValueChange={(v) =>
        startTransition(async () => {
          const res = await setUserRole(user.id, v as Role);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`${user.email} is now ${v === "ADMIN" ? "an admin" : "a user"}`);
        })
      }
    >
      <SelectTrigger className="w-28" aria-label={`Role for ${user.email}`}>
        <SelectValue>{ROLE_LABEL[user.role]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="USER">User</SelectItem>
        <SelectItem value="ADMIN">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ResetPasswordDialog({ user }: { user: UserRow }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setPw("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Reset password for ${user.email}`} title="Reset password">
          <KeyRound />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await resetPassword(user.id, pw);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Password changed");
              setOpen(false);
            });
          }}
        >
          <Field>
            <FieldLabel htmlFor="new-pw">New password</FieldLabel>
            <Input id="new-pw" type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
          </Field>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Set password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddUserDialog() {
  const empty = { email: "", name: "", password: "", role: "USER" as Role };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setForm(empty);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>New accounts are regular users unless you make them admin.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await createUser(form);
              if (!res.ok) return void toast.error(res.error);
              toast.success(`Added ${form.email}`);
              setOpen(false);
            });
          }}
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="u-email">Email</FieldLabel>
              <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="u-name">Name</FieldLabel>
              <Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="u-pw">Password</FieldLabel>
              <Input id="u-pw" type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </Field>
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger className="w-full">
                  <SelectValue>{ROLE_LABEL[form.role]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Only admins can sign in to the backstore.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersView({ users, meId }: { users: UserRow[]; meId: string }) {
  const admins = users.filter((u) => u.role === "ADMIN").length;
  return (
    <>
      <PageHeader title="Users" description={`${users.length} accounts · ${admins} admin${admins === 1 ? "" : "s"}`}>
        <AddUserDialog />
      </PageHeader>
      <div className="grid gap-2">
        {users.map((u) => {
          const isMe = u.id === meId;
          return (
            <Card key={u.id} className="flex-row items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase",
                  u.role === "ADMIN" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {u.role === "ADMIN" ? <ShieldCheck className="size-4" /> : (u.name ?? u.email).slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{u.name ?? u.email}</span>
                  {isMe && <Badge variant="secondary">You</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.name ? `${u.email} · ` : ""}joined {formatDate(u.createdAt)}
                </div>
              </div>
              <RoleSelect user={u} disabled={isMe} />
              <ResetPasswordDialog user={u} />
            </Card>
          );
        })}
      </div>
    </>
  );
}
