import "server-only";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { storage } from "@/server/storage";
import type { PayslipData } from "@/server/services/payroll/payslip.service";
import { amountInWords, amountInWordsAr } from "@/lib/payroll/words";
import { createFormat } from "@/lib/format";
import { lineNoteText, type PayrollTranslator } from "@/lib/payroll/issues";
import { isRtl, type AppLocale } from "@/i18n/config";
import { translatorFor } from "@/server/i18n";
import { readBrandAsset } from "@/server/brand-assets";
import { brand, palette } from "@/theme/brand";

/*
 * IBM Plex Sans Arabic (complete font: Latin + Arabic glyphs with full shaping tables) for both languages.
 * The @fontsource subsets are not used here: their trimmed layout tables crash the PDF font engine on
 * mixed Arabic/Latin runs.
 */
const fontFile = (style: string) => path.join(process.cwd(), "node_modules/@ibm/plex-sans-arabic/fonts/complete/woff", `IBMPlexSansArabic-${style}.woff`);
Font.register({ family: "Plex", fonts: [{ src: fontFile("Regular"), fontWeight: 400 }, { src: fontFile("Bold"), fontWeight: 700 }] });
Font.registerHyphenationCallback((word) => [word]); // never hyphenate (breaks Arabic shaping)
const FONT = "Plex";

const P = palette;
const s = StyleSheet.create({
  page: { padding: 36, paddingTop: 0, fontSize: 9, fontFamily: FONT, color: P.black },
  band: { marginHorizontal: -36, paddingHorizontal: 36, paddingVertical: 16, backgroundColor: P.black, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandLogo: { height: 40, maxWidth: 220, objectFit: "contain" },
  brandText: { fontSize: 14, fontWeight: 700, color: P.gold },
  accent: { marginHorizontal: -36, height: 3, backgroundColor: P.gold, marginBottom: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 10, marginBottom: 12, borderBottom: `1pt solid ${P.gray200}` },
  logo: { width: 40, height: 40, objectFit: "contain", marginRight: 10 },
  company: { fontSize: 12, fontWeight: 700 },
  muted: { color: P.gray600 },
  title: { fontSize: 16, fontWeight: 700, color: P.gold, textAlign: "right", letterSpacing: 2 },
  bandText: { color: P.gray300, textAlign: "right" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12, border: `1pt solid ${P.gray200}`, borderRadius: 4, padding: 8 },
  cell: { width: "33.33%", paddingVertical: 3 },
  label: { fontSize: 7, color: P.gray600, textTransform: "uppercase", marginBottom: 1 },
  tables: { flexDirection: "row", gap: 12 },
  table: { flex: 1, border: `1pt solid ${P.gray200}`, borderRadius: 4 },
  th: { flexDirection: "row", backgroundColor: P.black, color: P.gold, padding: 6, fontWeight: 700 },
  tr: { flexDirection: "row", paddingHorizontal: 6, paddingVertical: 4, borderTop: `1pt solid ${P.gray100}` },
  total: { flexDirection: "row", padding: 6, borderTop: `1pt solid ${P.gray200}`, backgroundColor: P.gray50, fontWeight: 700 },
  amount: { width: 80, textAlign: "right" },
  net: { marginTop: 14, padding: 10, backgroundColor: P.goldTint, borderLeft: `3pt solid ${P.gold}`, borderRadius: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  netValue: { fontSize: 16, fontWeight: 700, color: P.goldDark },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7, color: P.gray500, textAlign: "center", borderTop: `1pt solid ${P.gold}`, paddingTop: 6 },
});

type Labels = Awaited<ReturnType<typeof translatorFor<"documents">>>;

function Rows({ title, totalLabel, amountLabel, rows, total, money, rtl }: { title: string; totalLabel: string; amountLabel: string; rows: { name: string; amount: number; note: string | null }[]; total: number; money: (n: number) => string; rtl: boolean }) {
  const row = rtl ? "row-reverse" : "row";
  const align = rtl ? "right" : "left";
  return (
    <View style={s.table}>
      <View style={[s.th, { flexDirection: row }]}>
        <Text style={{ flex: 1, textAlign: align }}>{title}</Text>
        <Text style={[s.amount, { textAlign: rtl ? "left" : "right" }]}>{amountLabel}</Text>
      </View>
      {rows.length === 0 && (
        <View style={s.tr}>
          <Text style={s.muted}>—</Text>
        </View>
      )}
      {rows.map((r, i) => (
        <View key={i} style={[s.tr, { flexDirection: row }]} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={{ textAlign: align }}>{r.name}</Text>
            {r.note && <Text style={[s.muted, { fontSize: 7, textAlign: align }]}>{r.note}</Text>}
          </View>
          <Text style={[s.amount, { textAlign: rtl ? "left" : "right" }]}>{money(r.amount)}</Text>
        </View>
      ))}
      <View style={[s.total, { flexDirection: row }]}>
        <Text style={{ flex: 1, textAlign: align }}>{totalLabel}</Text>
        <Text style={[s.amount, { textAlign: rtl ? "left" : "right" }]}>{money(total)}</Text>
      </View>
    </View>
  );
}

/** Payslip PDF in the viewer's language (Arabic is laid out right-to-left). */
export async function renderPayslipPdf(p: PayslipData, locale: AppLocale = "en", words?: string): Promise<Buffer> {
  const t: Labels = await translatorFor(locale, "documents");
  const tPayroll = (await translatorFor(locale, "payroll")) as unknown as PayrollTranslator;
  const note = (n: string | null) => lineNoteText(n, tPayroll);
  const earnings = p.earnings.map((r) => ({ ...r, note: note(r.note) }));
  const deductions = p.deductions.map((r) => ({ ...r, note: note(r.note) }));
  const f = createFormat(locale);
  const rtl = isRtl(locale);
  const row = rtl ? "row-reverse" : "row";
  const align = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";
  const money = (n: number) => f.money(n, p.currency, { withCode: false });
  const brandLogo = await readBrandAsset("full");
  let logo: Buffer | null = null;
  if (p.company.logoPath && /\.(png|jpg)$/.test(p.company.logoPath)) logo = (await storage.get(p.company.logoPath))?.data ?? null;
  const c = p.company;
  const address = [c.addressLine1, c.addressLine2, c.city, c.emirate].filter(Boolean).join(", ");
  const field = (label: string, value: string | null | undefined) => (
    <View style={s.cell}>
      <Text style={[s.label, { textAlign: align }]}>{label}</Text>
      <Text style={{ textAlign: align }}>{value || "—"}</Text>
    </View>
  );
  const month = f.month(p.period);
  const doc = (
    <Document title={t("payslip.docTitle", { number: p.number })} author={c.legalName ?? c.name} subject={t("payslip.docSubject", { month })} language={locale}>
      <Page size="A4" style={s.page}>
        <View style={[s.band, { flexDirection: row }]}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {brandLogo ? <Image src={brandLogo} style={s.brandLogo} /> : <Text style={s.brandText}>{brand.company}</Text>}
          <View>
            <Text style={[s.title, { textAlign: end, letterSpacing: rtl ? 0 : 2 }]}>{t("payslip.title")}</Text>
            <Text style={[s.bandText, { textAlign: end }]}>{month}</Text>
            <Text style={[s.bandText, { textAlign: end }]}>{p.number}</Text>
          </View>
        </View>
        <View style={s.accent} />
        <View style={[s.header, { flexDirection: row }]}>
          <View style={{ flexDirection: row }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logo && <Image src={logo} style={[s.logo, rtl ? { marginRight: 0, marginLeft: 10 } : {}]} />}
            <View>
              <Text style={[s.company, { textAlign: align }]}>{c.legalName ?? c.name}</Text>
              {address && <Text style={[s.muted, { textAlign: align }]}>{address}</Text>}
              <Text style={[s.muted, { textAlign: align }]}>{[c.phone, c.email, c.tradeLicenseNumber && t("payslip.tradeLicence", { number: c.tradeLicenseNumber })].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
        </View>

        <View style={[s.grid, { flexDirection: row }]}>
          {field(t("payslip.employee"), p.employee.name)}
          {field(t("payslip.employeeNo"), p.employee.number)}
          {field(t("payslip.position"), p.employee.position)}
          {field(t("payslip.department"), p.employee.department)}
          {field(t("payslip.joinDate"), f.date(p.employee.joinDate))}
          {field(t("payslip.payPeriod"), `${f.date(p.periodStart)} – ${f.date(p.periodEnd)}`)}
          {field(t("payslip.paidDays"), `${f.number(p.paidDays)} (${p.basis === "THIRTY_DAYS" ? t("payslip.basis30") : t("payslip.basisCalendar")})`)}
          {field(t("payslip.unpaidLeaveDays"), f.number(p.unpaidLeaveDays))}
          {field(t("payslip.bankIban"), [p.employee.bankName, p.employee.ibanMasked].filter(Boolean).join(" · "))}
        </View>

        <View style={[s.tables, { flexDirection: row }]}>
          <Rows title={t("payslip.earnings")} totalLabel={t("payslip.totalEarnings")} amountLabel={t("payslip.amount")} rows={earnings} total={p.gross} money={money} rtl={rtl} />
          <Rows title={t("payslip.deductions")} totalLabel={t("payslip.totalDeductions")} amountLabel={t("payslip.amount")} rows={deductions} total={p.totalDeductions} money={money} rtl={rtl} />
        </View>

        <View style={[s.net, { flexDirection: row }, rtl ? { borderLeft: 0, borderRight: `3pt solid ${P.gold}` } : {}]}>
          <View style={rtl ? { flex: 1, paddingLeft: 12 } : { flex: 1, paddingRight: 12 }}>
            <Text style={[s.label, { textAlign: align }]}>{t("payslip.netPay")}</Text>
            <Text style={{ textAlign: align }}>{words ?? (locale === "ar" ? amountInWordsAr(p.net, p.currency) : amountInWords(p.net, p.currency))}</Text>
          </View>
          <Text style={s.netValue}>{f.money(p.net, p.currency)}</Text>
        </View>

        <View style={[s.grid, { marginTop: 12, flexDirection: row }]}>
          <Text style={[s.label, { width: "100%", marginBottom: 4, fontWeight: 700, textAlign: align }]}>{t("payslip.ytd", { month: f.month(p.ytd.from) })}</Text>
          {field(t("payslip.grossYtd"), f.money(p.ytd.gross, p.currency))}
          {field(t("payslip.deductionsYtd"), f.money(p.ytd.deductions, p.currency))}
          {field(t("payslip.netYtd"), f.money(p.ytd.net, p.currency))}
        </View>

        <Text style={s.footer} fixed>
          {t("payslip.footer", { date: f.date(p.releasedAt) })}
        </Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

/** AES-256 encrypt a PDF so it opens only with `password` (printing allowed, editing not). */
export async function encryptPdf(pdf: Buffer | Uint8Array, password: string): Promise<Uint8Array> {
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const doc = await PDFDocument.load(pdf);
  doc.encrypt({ userPassword: password, ownerPassword: randomBytes(24).toString("hex"), permissions: { printing: "highResolution", modifying: false, copying: false, annotating: false } });
  return doc.save({ useObjectStreams: false });
}
