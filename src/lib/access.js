// What a logged-in account may do. Mirrors current_user_is_staff() in the database:
// active + (position or admin) = staff; no position yet = pending (new sign-up); deactivated = inactive.
export function accessState(profile) {
  if (!profile) return "loading";
  if (profile.is_active === false) return "inactive";
  if (profile.is_admin === true || String(profile.position ?? "").trim()) return "staff";
  return "pending";
}
