import "server-only";

export interface User {
  id: string;
}

// Replace with your session lookup (cookies(), your auth library). The example trusts
// EXAMPLE_LOCAL_USER, so nothing can be uploaded until you set it.
export function getCurrentUser(): User | null {
  const id = process.env.EXAMPLE_LOCAL_USER;
  return id ? { id } : null;
}

export function ownerOf(user: User) {
  return { entity: { type: "user", id: user.id }, actorId: user.id };
}
