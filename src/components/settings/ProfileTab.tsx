import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/sala_translations_is";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

export function ProfileTab() {
  const profile = useCurrentProfile();
  const [name, setName] = useState(profile.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const saveName = async () => {
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() || null })
      .eq("id", profile.id);
    setSavingName(false);
    if (error) toast.error(t.status.somethingWentWrong);
    else toast.success(t.status.savedSuccessfully);
  };

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error(t.status.somethingWentWrong);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", profile.id);
    setUploading(false);
    if (updErr) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    setAvatarUrl(url);
    toast.success(t.status.savedSuccessfully);
  };

  const changePassword = async () => {
    if (newPw.length < 8) {
      toast.error(t.settings.passwordTooShort);
      return;
    }
    if (newPw !== confirmPw) {
      toast.error(t.settings.passwordMismatch);
      return;
    }
    setPwSaving(true);
    // Re-authenticate to confirm current password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPw,
    });
    if (signInErr) {
      setPwSaving(false);
      toast.error(t.login.wrongCredentials);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    toast.success(t.settings.passwordChanged);
  };

  return (
    <div className="space-y-8 max-w-xl">
      <section className="space-y-4 rounded-md border border-border bg-card p-6">
        <h2 className="text-base font-semibold">{t.settings.profileSection}</h2>

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (profile.name ?? profile.email).charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <Label htmlFor="avatar" className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              {uploading ? t.dealFile.uploading : t.settings.avatarUpload}
            </Label>
            <Input id="avatar" type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">{t.settings.displayName}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.login.email}</Label>
          <Input value={profile.email} disabled />
        </div>
        <div>
          <Button onClick={saveName} disabled={savingName} className="bg-ide-navy text-white hover:bg-ide-navy-hover">
            {savingName ? t.status.saving : t.actions.save}
          </Button>
        </div>
      </section>

      {!profile.isOauth && (
        <section className="space-y-4 rounded-md border border-border bg-card p-6">
          <h2 className="text-base font-semibold">{t.settings.passwordSection}</h2>
          <div className="space-y-1.5">
            <Label htmlFor="cpw">{t.settings.currentPassword}</Label>
            <Input id="cpw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="npw">{t.settings.newPassword}</Label>
            <Input id="npw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnpw">{t.settings.confirmPassword}</Label>
            <Input id="cnpw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <Button onClick={changePassword} disabled={pwSaving} className="bg-ide-navy text-white hover:bg-ide-navy-hover">
              {pwSaving ? t.status.saving : t.settings.changePassword}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
