-- Fix 1: Restrict EXECUTE on SECURITY DEFINER trigger/helper functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- has_role must remain executable by authenticated because RLS policies evaluate it in the caller's context
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Fix 2: Allow anonymous visitors to browse published projects
GRANT SELECT ON public.projects TO anon;
CREATE POLICY "Anon read published projects"
  ON public.projects
  FOR SELECT
  TO anon
  USING (is_published = true);

-- Fix 3: Add explicit admin-only INSERT/DELETE policies on user_roles
-- to prevent privilege escalation. The handle_new_user trigger is
-- SECURITY DEFINER so it bypasses RLS and continues to seed 'user' role on signup.
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));