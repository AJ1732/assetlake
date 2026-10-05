export interface User {
  id: string;
}

// Replace with your session lookup (cookie, JWT, API key). The example trusts EXAMPLE_LOCAL_USER,
// so nothing can be uploaded until you set it.
export function getCurrentUser(): User | null {
  const id = process.env.EXAMPLE_LOCAL_USER;
  return id ? { id } : null;
}
