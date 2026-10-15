export const displayName = (e: { firstName: string; lastName: string; preferredName?: string | null }) => `${e.preferredName || e.firstName} ${e.lastName}`;
