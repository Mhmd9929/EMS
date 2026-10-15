import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { storage } from "@/server/storage";
import type { PayslipData } from "@/server/services/payroll/payslip.service";
import { formatMoney } from "@/lib/payroll/money";
import { amountInWords } from "@/lib/payroll/words";
import { periodLabel } from "@/lib/payroll/calc";
import { formatDate } from "@/lib/dates";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#18181b" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2pt solid #0f766e", paddingBottom: 10, marginBottom: 14 },
  logo: { width: 48, height: 48, objectFit: "contain", marginRight: 10 },
  company: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  muted: { color: "#71717a" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#0f766e", textAlign: "right" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12, border: "1pt solid #e4e4e7", borderRadius: 4, padding: 8 },
  cell: { width: "33.33%", paddingVertical: 3 },
  label: { fontSize: 7, color: "#71717a", textTransform: "uppercase", marginBottom: 1 },
  tables: { flexDirection: "row", gap: 12 },
  table: { flex: 1, border: "1pt solid #e4e4e7", borderRadius: 4 },
  th: { flexDirection: "row", backgroundColor: "#f4f4f5", padding: 6, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingHorizontal: 6, paddingVertical: 4, borderTop: "1pt solid #f4f4f5" },
  total: { flexDirection: "row", padding: 6, borderTop: "1pt solid #e4e4e7", fontFamily: "Helvetica-Bold" },
  amount: { width: 80, textAlign: "right" },
  net: { marginTop: 14, padding: 10, backgroundColor: "#f0fdfa", border: "1pt solid #99f6e4", borderRadius: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  netValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0f766e" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7, color: "#a1a1aa", textAlign: "center" },
});

function Rows({ title, rows, total, currency }: { title: string; rows: { name: string; amount: number; note: string | null }[]; total: number; currency: string }) {
  return (
    <View style={s.table}>
      <View style={s.th}>
        <Text style={{ flex: 1 }}>{title}</Text>
        <Text style={s.amount}>Amount</Text>
      </View>
      {rows.length === 0 && (
        <View style={s.tr}>
          <Text style={s.muted}>—</Text>
        </View>
      )}
      {rows.map((r, i) => (
        <View key={i} style={s.tr} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text>{r.name}</Text>
            {r.note && <Text style={[s.muted, { fontSize: 7 }]}>{r.note}</Text>}
          </View>
          <Text style={s.amount}>{formatMoney(r.amount, currency, { withCode: false })}</Text>
        </View>
      ))}
      <View style={s.total}>
        <Text style={{ flex: 1 }}>Total {title.toLowerCase()}</Text>
        <Text style={s.amount}>{formatMoney(total, currency, { withCode: false })}</Text>
      </View>
    </View>
  );
}

export async function renderPayslipPdf(p: PayslipData): Promise<Buffer> {
  let logo: Buffer | null = null;
  if (p.company.logoPath && /\.(png|jpg)$/.test(p.company.logoPath)) logo = (await storage.get(p.company.logoPath))?.data ?? null;
  const c = p.company;
  const address = [c.addressLine1, c.addressLine2, c.city, c.emirate].filter(Boolean).join(", ");
  const field = (label: string, value: string | null | undefined) => (
    <View style={s.cell}>
      <Text style={s.label}>{label}</Text>
      <Text>{value || "—"}</Text>
    </View>
  );
  const doc = (
    <Document title={`Payslip ${p.number}`} author={c.legalName ?? c.name} subject={`Payslip ${periodLabel(p.period)}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={{ flexDirection: "row" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logo && <Image src={logo} style={s.logo} />}
            <View>
              <Text style={s.company}>{c.legalName ?? c.name}</Text>
              {address && <Text style={s.muted}>{address}</Text>}
              <Text style={s.muted}>{[c.phone, c.email, c.tradeLicenseNumber && `TL ${c.tradeLicenseNumber}`].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
          <View>
            <Text style={s.title}>PAYSLIP</Text>
            <Text style={{ textAlign: "right" }}>{periodLabel(p.period)}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>{p.number}</Text>
          </View>
        </View>

        <View style={s.grid}>
          {field("Employee", p.employee.name)}
          {field("Employee no.", p.employee.number)}
          {field("Position", p.employee.position)}
          {field("Department", p.employee.department)}
          {field("Join date", formatDate(p.employee.joinDate))}
          {field("Pay period", `${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`)}
          {field("Paid days", `${p.paidDays} (${p.basis === "THIRTY_DAYS" ? "30-day basis" : "calendar days"})`)}
          {field("Unpaid leave days", String(p.unpaidLeaveDays))}
          {field("Bank / IBAN", [p.employee.bankName, p.employee.ibanMasked].filter(Boolean).join(" · "))}
        </View>

        <View style={s.tables}>
          <Rows title="Earnings" rows={p.earnings} total={p.gross} currency={p.currency} />
          <Rows title="Deductions" rows={p.deductions} total={p.totalDeductions} currency={p.currency} />
        </View>

        <View style={s.net}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.label}>Net pay</Text>
            <Text>{amountInWords(p.net, p.currency)}</Text>
          </View>
          <Text style={s.netValue}>{formatMoney(p.net, p.currency)}</Text>
        </View>

        <View style={[s.grid, { marginTop: 12 }]}>
          {field(`Year to date (from ${p.ytd.from})`, "")}
          {field("Gross YTD", formatMoney(p.ytd.gross, p.currency))}
          {field("Deductions YTD", formatMoney(p.ytd.deductions, p.currency))}
          {field("Net YTD", formatMoney(p.ytd.net, p.currency))}
        </View>

        <Text style={s.footer} fixed>
          Computer-generated payslip — no signature required. Released {formatDate(p.releasedAt)}. Confidential.
        </Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
