import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { requireAuth } from "@/server/auth/context";
import { getEmployeeDetail } from "@/server/services/employee.service";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PhotoUpload } from "@/components/employees/photo-upload";
import { EmergencyContacts } from "@/components/employees/emergency-contacts";
import { formatDate } from "@/lib/dates";
import { EMPLOYMENT_TYPES, GENDERS, labelOf } from "@/lib/constants";
import { formatIban } from "@/lib/iban";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const ctx = await requireAuth();
  if (!ctx.employeeId) redirect("/profile/password");
  const e = await getEmployeeDetail(ctx, ctx.employeeId);
  const rows: [string, React.ReactNode][] = [
    ["Employee number", <span key="n" className="font-mono">{e.employeeNumber}</span>],
    ["Work email", e.workEmail],
    ["Position", e.position?.title],
    ["Department", e.department?.name],
    ["Manager", e.manager ? `${e.manager.preferredName || e.manager.firstName} ${e.manager.lastName}` : null],
    ["Location", e.location?.name],
    ["Employment type", labelOf(EMPLOYMENT_TYPES, e.employmentType)],
    ["Join date", formatDate(e.joinDate)],
    ["Date of birth", formatDate(e.dateOfBirth)],
    ["Gender", e.gender ? labelOf(GENDERS, e.gender) : null],
    ["Nationality", e.nationality],
    ["Emirates ID", e.emiratesIdNumber ? `${e.emiratesIdNumber} (exp. ${formatDate(e.emiratesIdExpiry)})` : null],
    ["Passport", e.passportNumber ? `${e.passportNumber} (exp. ${formatDate(e.passportExpiry)})` : null],
    ["Bank", e.bankName],
    ["IBAN", e.iban ? <span key="i" className="font-mono">{formatIban(e.iban)}</span> : null],
  ];
  return (
    <>
      <PageHeader
        title="My profile"
        description="Keep your contact details up to date. Ask HR to change job, identity or bank details."
        actions={
          <Link href="/profile/password" className={buttonVariants({ variant: "outline" })}>
            <KeyRound aria-hidden /> Change password
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 text-center">
              <Avatar employeeId={e.id} hasPhoto={!!e.photoPath} version={e.photoPath} firstName={e.firstName} lastName={e.lastName} size={96} />
              <div>
                <p className="font-semibold">
                  {e.preferredName || e.firstName} {e.lastName}
                </p>
                <p className="text-muted-foreground text-sm">{e.position?.title}</p>
              </div>
              <PhotoUpload employeeId={e.id} hasPhoto={!!e.photoPath} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employment record</CardTitle>
              <CardDescription>Maintained by HR</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground shrink-0">{k}</dt>
                    <dd className="truncate text-right">{v ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal information</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm
                defaults={{
                  preferredName: e.preferredName ?? "",
                  personalEmail: e.personalEmail ?? "",
                  phone: e.phone ?? "",
                  address: e.address ?? "",
                  maritalStatus: e.maritalStatus ?? "",
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emergency contacts</CardTitle>
              <CardDescription>Who should we call in an emergency? Up to 5 contacts.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmergencyContacts employeeId={e.id} contacts={e.emergencyContacts} canManage />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
