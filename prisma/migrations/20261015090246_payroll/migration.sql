-- CreateEnum
CREATE TYPE "ProrationBasis" AS ENUM ('CALENDAR_DAYS', 'THIRTY_DAYS');

-- CreateEnum
CREATE TYPE "PayComponentKind" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayCalcType" AS ENUM ('FIXED', 'FORMULA');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollScope" AS ENUM ('ALL', 'DEPARTMENT', 'LOCATION');

-- CreateEnum
CREATE TYPE "PayrollEntryStatus" AS ENUM ('INCLUDED', 'HELD', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "gratuityCapMonths" DECIMAL(5,2) NOT NULL DEFAULT 24,
ADD COLUMN     "gratuityDailyBasis" TEXT NOT NULL DEFAULT 'DIV30',
ADD COLUMN     "gratuityDaysAfter" DECIMAL(5,2) NOT NULL DEFAULT 30,
ADD COLUMN     "gratuityDaysFirstYears" DECIMAL(5,2) NOT NULL DEFAULT 21,
ADD COLUMN     "gratuityMinServiceYears" DECIMAL(4,2) NOT NULL DEFAULT 1,
ADD COLUMN     "gratuityThresholdYears" DECIMAL(4,2) NOT NULL DEFAULT 5,
ADD COLUMN     "leaveEncashmentBasis" TEXT NOT NULL DEFAULT 'BASIC',
ADD COLUMN     "payrollProrationBasis" "ProrationBasis" NOT NULL DEFAULT 'CALENDAR_DAYS',
ADD COLUMN     "wpsEmployerBankCode" TEXT,
ADD COLUMN     "wpsEmployerId" TEXT,
ADD COLUMN     "wpsFormat" TEXT NOT NULL DEFAULT 'UAE_SIF_V1';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "bankRoutingCode" TEXT;

-- AlterTable
ALTER TABLE "LeaveType" ADD COLUMN     "isEncashable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PayComponent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PayComponentKind" NOT NULL,
    "calcType" "PayCalcType" NOT NULL DEFAULT 'FIXED',
    "formula" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "isTaxable" BOOLEAN NOT NULL DEFAULT false,
    "isFixedPay" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PayComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructureLine" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" BIGINT,

    CONSTRAINT "SalaryStructureLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "runId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "scope" "PayrollScope" NOT NULL DEFAULT 'ALL',
    "scopeId" TEXT,
    "scopeLabel" TEXT NOT NULL DEFAULT 'All employees',
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "prorationBasis" "ProrationBasis" NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "totalGross" BIGINT NOT NULL DEFAULT 0,
    "totalDeductions" BIGINT NOT NULL DEFAULT 0,
    "totalNet" BIGINT NOT NULL DEFAULT 0,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "calculatedById" TEXT,
    "calculatedAt" TIMESTAMPTZ(3),
    "submittedById" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "releasedById" TEXT,
    "releasedAt" TIMESTAMPTZ(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelReason" TEXT,
    "reviewComment" TEXT,
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRunEmployee" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "PayrollEntryStatus" NOT NULL DEFAULT 'INCLUDED',
    "statusReason" TEXT,
    "employeeNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "location" TEXT,
    "joinDate" DATE NOT NULL,
    "lastWorkingDay" DATE,
    "bankName" TEXT,
    "iban" TEXT,
    "bankRoutingCode" TEXT,
    "labourCardNumber" TEXT,
    "calendarDays" INTEGER NOT NULL,
    "paidDays" DECIMAL(6,2) NOT NULL,
    "unpaidLeaveDays" DECIMAL(6,2) NOT NULL,
    "gross" BIGINT NOT NULL,
    "deductions" BIGINT NOT NULL,
    "net" BIGINT NOT NULL,
    "fixedPay" BIGINT NOT NULL DEFAULT 0,
    "variablePay" BIGINT NOT NULL DEFAULT 0,
    "previousNet" BIGINT,
    "issues" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "PayrollRunEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRunLine" (
    "id" TEXT NOT NULL,
    "runEmployeeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PayComponentKind" NOT NULL,
    "amount" BIGINT NOT NULL,
    "note" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "isFixedPay" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PayrollRunLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "runEmployeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "net" BIGINT NOT NULL,
    "releasedAt" TIMESTAMPTZ(3) NOT NULL,
    "voidedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalSettlement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "lastWorkingDay" DATE NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "serviceYears" DECIMAL(6,3) NOT NULL,
    "basicSalary" BIGINT NOT NULL,
    "unpaidSalaryDays" DECIMAL(6,2) NOT NULL,
    "unpaidSalary" BIGINT NOT NULL,
    "leaveDays" DECIMAL(6,2) NOT NULL,
    "leaveEncashment" BIGINT NOT NULL,
    "gratuity" BIGINT NOT NULL,
    "otherEarnings" BIGINT NOT NULL DEFAULT 0,
    "deductions" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL,
    "notes" TEXT,
    "breakdown" JSONB NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FinalSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayComponent_companyId_code_key" ON "PayComponent"("companyId", "code");

-- CreateIndex
CREATE INDEX "SalaryStructure_companyId_idx" ON "SalaryStructure"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_employeeId_effectiveFrom_key" ON "SalaryStructure"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureLine_structureId_componentId_key" ON "SalaryStructureLine"("structureId", "componentId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_companyId_period_idx" ON "PayrollAdjustment"("companyId", "period");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_employeeId_period_idx" ON "PayrollAdjustment"("employeeId", "period");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_period_idx" ON "PayrollRun"("companyId", "period");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_status_idx" ON "PayrollRun"("companyId", "status");

-- CreateIndex
CREATE INDEX "PayrollRunEmployee_employeeId_idx" ON "PayrollRunEmployee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRunEmployee_runId_employeeId_key" ON "PayrollRunEmployee"("runId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_runEmployeeId_key" ON "Payslip"("runEmployeeId");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_period_idx" ON "Payslip"("employeeId", "period");

-- CreateIndex
CREATE INDEX "Payslip_companyId_period_idx" ON "Payslip"("companyId", "period");

-- CreateIndex
CREATE INDEX "FinalSettlement_companyId_status_idx" ON "FinalSettlement"("companyId", "status");

-- CreateIndex
CREATE INDEX "FinalSettlement_employeeId_idx" ON "FinalSettlement"("employeeId");

-- AddForeignKey
ALTER TABLE "PayComponent" ADD CONSTRAINT "PayComponent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureLine" ADD CONSTRAINT "SalaryStructureLine_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureLine" ADD CONSTRAINT "SalaryStructureLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunEmployee" ADD CONSTRAINT "PayrollRunEmployee_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunEmployee" ADD CONSTRAINT "PayrollRunEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunLine" ADD CONSTRAINT "PayrollRunLine_runEmployeeId_fkey" FOREIGN KEY ("runEmployeeId") REFERENCES "PayrollRunEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_runEmployeeId_fkey" FOREIGN KEY ("runEmployeeId") REFERENCES "PayrollRunEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalSettlement" ADD CONSTRAINT "FinalSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seeded UAE default Annual Leave is encashable on existing databases too.
UPDATE "LeaveType" SET "isEncashable" = true WHERE "code" = 'AL' AND "isSystemDefault" = true;
