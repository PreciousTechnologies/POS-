import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Power, Search, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Role, User, UserInput } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ErrorPanel } from "@/components/ui/States";

type UserForm = {
  name: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
  password: string;
};

const emptyForm: UserForm = {
  name: "",
  username: "",
  email: "",
  role: "cashier",
  active: true,
  password: "",
};

export function UsersPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deactivating, setDeactivating] = useState<User | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.users
      .list()
      .then((result) => {
        if (!cancelled) setUsers(result.items);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load users.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      active: user.active,
      password: "",
    });
    setFormError(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (form.name.trim().length < 2) {
      setFormError("Enter the team member’s full name.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(form.username.trim())) {
      setFormError("Username must be 3–30 characters using letters, numbers, dots, dashes or underscores.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (!editing && form.password.length < 6) {
      setFormError("Set a password with at least 6 characters.");
      return;
    }
    if (editing && form.password && form.password.length < 6) {
      setFormError("A new password must have at least 6 characters.");
      return;
    }

    const input: UserInput = {
      name: form.name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      role: form.role,
      active: form.active,
      password: form.password || undefined,
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        const updated = await api.users.update(editing.id, input);
        toast.success(`${updated.name}’s account was updated.`);
        if (updated.id === currentUser?.id) await refreshUser();
      } else {
        const created = await api.users.create(input);
        toast.success(`${created.name} can now sign in as a ${created.role}.`);
      }
      setFormOpen(false);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not save this user.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (target: User) => {
    const input: UserInput = {
      name: target.name,
      username: target.username,
      email: target.email,
      role: target.role,
      active: !target.active,
    };
    setToggling(true);
    try {
      const updated = await api.users.update(target.id, input);
      toast.success(
        updated.active ? `${updated.name} has been reactivated.` : `${updated.name} has been deactivated.`,
      );
      setDeactivating(null);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update this account.");
    } finally {
      setToggling(false);
    }
  };

  const filtered = users.filter((user) => {
    if (roleFilter && user.role !== roleFilter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [user.name, user.username, user.email].some((value) => value.toLowerCase().includes(query));
  });

  const columns: Column<User>[] = [
    {
      key: "person",
      header: "Team member",
      cell: (user) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0">
            <div className="cell-main flex items-center gap-1.5">
              {user.name}
              {user.id === currentUser?.id && <span className="text-[9px] font-semibold soft">(you)</span>}
            </div>
            <div className="cell-sub">@{user.username}</div>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (user) => <span className="max-w-[220px] truncate text-[11px]">{user.email}</span>,
    },
    {
      key: "role",
      header: "Role",
      cell: (user) => <RoleBadge role={user.role} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (user) => (
        <Badge tone={user.active ? "success" : "neutral"} dot>
          {user.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (user) => {
        const isSelf = user.id === currentUser?.id;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openEdit(user)}
              aria-label={`Edit ${user.name}`}
              title="Edit account"
            >
              <Pencil size={13} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                if (user.active) setDeactivating(user);
                else void toggleActive(user);
              }}
              disabled={isSelf && user.active}
              aria-label={user.active ? `Deactivate ${user.name}` : `Reactivate ${user.name}`}
              title={
                isSelf && user.active
                  ? "You cannot deactivate your own account"
                  : user.active
                    ? "Deactivate account"
                    : "Reactivate account"
              }
              style={{ color: user.active ? "var(--danger)" : "var(--success)" }}
            >
              <Power size={13} />
            </Button>
          </div>
        );
      },
    },
  ];

  const isSelf = editing?.id === currentUser?.id;

  return (
    <div className="page-shell">
      <PageHeader
        title="Users"
        subtitle="Manage who can open the register and who can administer the business."
        icon={<Users size={18} />}
        actions={
          <Button onClick={openCreate} leftIcon={<UserPlus size={14} />}>
            Add user
          </Button>
        }
      />

      {error && <ErrorPanel message={error} onRetry={() => setReloadKey((value) => value + 1)} />}

      <div className="stat-row grid-cols-2 sm:grid-cols-4">
        <div className="stat-box">
          <div className="stat-box-value numeric">{users.length}</div>
          <div className="stat-box-label">Team members</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-value numeric">{users.filter((user) => user.role === "admin").length}</div>
          <div className="stat-box-label">Administrators</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-value numeric">{users.filter((user) => user.role === "cashier").length}</div>
          <div className="stat-box-label">Cashiers</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-value numeric">{users.filter((user) => !user.active).length}</div>
          <div className="stat-box-label">Inactive</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="input-icon-wrap min-w-[210px] flex-1 sm:max-w-[310px]">
              <Search size={14} />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, username or email"
                aria-label="Search users"
              />
            </div>
            <Select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as Role | "")}
              className="w-[140px]"
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              <option value="admin">Administrators</option>
              <option value="cashier">Cashiers</option>
            </Select>
            {(search || roleFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("");
                }}
                leftIcon={<X size={12} />}
              >
                Clear
              </Button>
            )}
          </div>
          <span className="text-[10px] soft">
            {filtered.length} of {users.length}
          </span>
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(user) => user.id}
          loading={loading}
          className="table-plain"
          minWidth={760}
          empty={
            <div className="empty-state">
              <div className="empty-icon">
                <Users size={22} strokeWidth={1.7} />
              </div>
              <div className="empty-title">{search || roleFilter ? "No users match" : "No users yet"}</div>
              <div className="empty-copy">
                {search || roleFilter
                  ? "Clear the search or role filter to see everyone."
                  : "Add the first team member to give them access to the register."}
              </div>
              {!search && !roleFilter && (
                <Button size="sm" className="mt-2" onClick={openCreate} leftIcon={<UserPlus size={13} />}>
                  Add user
                </Button>
              )}
            </div>
          }
        />
      </div>

      <section className="card">
        <div className="card-body flex items-start gap-3">
          <ShieldCheck size={17} className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
          <div className="text-[10.5px] leading-relaxed muted">
            Cashiers can sell, print receipts, and see their own sales. Administrators can also manage stock,
            products, users, settings, reports, voids, and refunds. At least one active administrator must always
            remain.
          </div>
        </div>
      </section>

      <Modal
        open={formOpen}
        onClose={() => {
          if (!saving) setFormOpen(false);
        }}
        title={editing ? "Edit account" : "Add team member"}
        description={
          editing
            ? `Update ${editing.name}’s profile, role, or password.`
            : "Create an account for a cashier or another administrator."
        }
        size="sm"
        dismissible={!saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} leftIcon={<UserPlus size={14} />}>
              {editing ? "Save changes" : "Create user"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <div className="alert alert-danger">{formError}</div>}
          <div className="form-grid">
            <Field label="Full name" required className="field-full sm:col-span-1">
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Neema Mushi"
                autoFocus
              />
            </Field>
            <Field label="Username" required>
              <Input
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="e.g. neema"
                autoComplete="off"
              />
            </Field>
            <Field label="Email" required className="field-full">
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="name@business.co.tz"
                autoComplete="off"
              />
            </Field>
            <Field label="Role" required>
              <Select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as Role }))}
                disabled={isSelf}
              >
                <option value="cashier">Cashier</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
            <Field
              label={editing ? "New password" : "Password"}
              required={!editing}
              hint={editing ? "Leave blank to keep the current password." : "At least 6 characters."}
            >
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder={editing ? "Optional" : "Minimum 6 characters"}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <label className="check-row surface-soft cursor-pointer p-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.active}
              disabled={isSelf}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
            />
            <span>
              <span className="block text-[11.5px] font-semibold">Account is active</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed soft">
                {isSelf
                  ? "You cannot deactivate your own account or remove your own administrator role."
                  : "Inactive users keep their history but cannot sign in."}
              </span>
            </span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        onConfirm={() => {
          if (deactivating) void toggleActive(deactivating);
        }}
        title={`Deactivate ${deactivating?.name ?? "this user"}?`}
        description="They will be signed out on their next request and will no longer be able to use the register. You can reactivate the account later."
        confirmLabel="Deactivate"
        destructive
        loading={toggling}
      />
    </div>
  );
}
