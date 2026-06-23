import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { myProfile, updateProfile } from "@/lib/projects.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const profileFn = useServerFn(myProfile);
  const updateFn = useServerFn(updateProfile);
  
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const [username, setUsername] = useState("");
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.profile?.username) setUsername(data.profile.username);
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFn({ data: { username } });
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account details.
        </p>
      </div>

      <div className="rounded-xl border bg-surface p-6 shadow-card">
        <form className="space-y-4" onSubmit={save}>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={data?.profile?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={4}
              maxLength={20}
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={data?.isAdmin ? "default" : "secondary"}>
              {data?.isAdmin ? (
                <>
                  <ShieldCheck className="h-3 w-3 mr-1" /> Admin
                </>
              ) : (
                "User"
              )}
            </Badge>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </div>

    </div>
  );
}
