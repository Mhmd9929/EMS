import { cn, initials } from "@/lib/utils";

/** Employee avatar: photo (served via the authenticated file route) or initials. */
export function Avatar({
  employeeId,
  hasPhoto,
  firstName,
  lastName,
  size = 36,
  className,
  version,
}: {
  employeeId?: string | null;
  hasPhoto?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  className?: string;
  version?: string | null;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size / 2.8)) };
  if (hasPhoto && employeeId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/files/photo/${employeeId}${version ? `?v=${encodeURIComponent(version.slice(-12))}` : ""}`}
        alt=""
        width={size}
        height={size}
        style={style}
        className={cn("shrink-0 rounded-full object-cover bg-muted", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn("bg-primary/15 text-primary inline-flex shrink-0 items-center justify-center rounded-full font-semibold", className)}
    >
      {initials(firstName, lastName)}
    </span>
  );
}
