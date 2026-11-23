export function validatePassword(password: string, confirmation: string) {
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (password !== confirmation) throw new Error("Passwords do not match.");
}

export function validateAccountEdit(
  actorId: string,
  targetId: string,
  isAdmin: boolean,
  isActive: boolean,
) {
  if (actorId === targetId && (!isAdmin || !isActive)) {
    throw new Error("You cannot remove your own administrator access.");
  }
}
