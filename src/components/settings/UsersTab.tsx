import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleProfiles } from "@/lib/hiddenUsers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/lib/sala_translations_is";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import type { AppRole } from "@/lib/role";

interface Row {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
  active: boolean;
}

const ROLES: AppRole[] = ["admin", "sales", "designer", "viewer"];

export function UsersTab() {
  const me = useCurrentProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, email, name, role, active")
      .order("email");
    setRows(filterVisibleProfiles((data ?? []) as Row[]));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t.settings.usersTitle}</h2>
        <Button
          onClick={() => setInviteOpen(true)}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          + {t.settings.inviteUser}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{t.settings.userName}</th>
              <th className="px-3 py-2 text-left">{t.settings.userEmail}</th>
              <th className="px-3 py-2 text-left">{t.settings.userRole}</th>
              <th className="px-3 py-2 text-left">{t.settings.userStatus}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {t.status.loading}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {t.status.noResults}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{r.name ?? "—"}</td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">{t.userRole[r.role]}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        r.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {r.active ? t.settings.userActive : t.settings.userInactive}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(r)}
                      disabled={r.id === me.id}
                      title={r.id === me.id ? t.settings.cannotEditSelf : ""}
                    >
                      {t.settings.editUser}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EditUserDialog
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={async () => {
          setInviteOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("sales");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setRole(user.role);
      setActive(user.active);
    }
  }, [user]);

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() || null, role, active })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    onSaved();
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.settings.userName}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.settings.userRole}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t.userRole[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">{t.settings.userActive}</div>
              <div className="text-xs text-muted-foreground">
                {active ? t.settings.userActive : t.settings.userInactive}
              </div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.actions.cancel}</Button>
          <Button onClick={save} disabled={saving} className="bg-ide-navy text-white hover:bg-ide-navy-hover">
            {saving ? t.status.saving : t.settings.saveUser}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteUserDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("sales");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { email: email.trim(), name: name.trim() || null, role },
    });
    setSending(false);
    if (error || (data && (data as { error?: string }).error)) {
      const msg = error?.message ?? (data as { error?: string }).error ?? t.settings.inviteFailed;
      toast.error(msg);
      return;
    }
    toast.success(t.settings.inviteSent);
    setEmail("");
    setName("");
    setRole("sales");
    onInvited();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.settings.inviteUser}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.settings.inviteEmail}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.settings.userName}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.settings.inviteRole}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t.userRole[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.actions.cancel}</Button>
          <Button onClick={submit} disabled={sending || !email.trim()} className="bg-ide-navy text-white hover:bg-ide-navy-hover">
            {sending ? t.settings.inviteSending : t.settings.inviteSend}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
