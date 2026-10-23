-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SEEKER', 'VOLUNTEER', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'AWAITING_CONFIRMATION', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'BLOCKED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NeedCategory" AS ENUM ('FOOD_NUTRITION', 'MEDICAL_HEALTH', 'ELDERLY_CARE', 'SHELTER_CLOTHING', 'TRANSPORT_LOGISTICS', 'EMERGENCY_REPAIR');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('TASK_PREREQUISITE', 'RESOURCE_STOCK', 'VOLUNTEER_QUALIFICATION', 'RECIPIENT_CONTACT');

-- CreateTable
CREATE TABLE "User" (
    "id" VARCHAR(30) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320),
    "role" "UserRole" NOT NULL DEFAULT 'SEEKER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerProfile" (
    "userId" VARCHAR(30) NOT NULL,
    "phone" VARCHAR(64),
    "avatar" TEXT,
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 0,
    "timeSlots" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedTasksCount" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "VolunteerSkill" (
    "volunteerId" VARCHAR(30) NOT NULL,
    "skill" VARCHAR(100) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VolunteerSkill_pkey" PRIMARY KEY ("volunteerId","skill")
);

-- CreateTable
CREATE TABLE "VolunteerServiceArea" (
    "volunteerId" VARCHAR(30) NOT NULL,
    "area" VARCHAR(120) NOT NULL,

    CONSTRAINT "VolunteerServiceArea_pkey" PRIMARY KEY ("volunteerId","area")
);

-- CreateTable
CREATE TABLE "CommunityRequest" (
    "id" VARCHAR(30) NOT NULL,
    "trackingCode" VARCHAR(24) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "NeedCategory" NOT NULL,
    "urgency" "UrgencyLevel" NOT NULL DEFAULT 'MEDIUM',
    "locationArea" VARCHAR(160) NOT NULL,
    "recipientName" VARCHAR(160) NOT NULL,
    "recipientContact" VARCHAR(200) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "isDemoSample" BOOLEAN NOT NULL DEFAULT false,
    "createdById" VARCHAR(30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" VARCHAR(30) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" "NeedCategory" NOT NULL,
    "unit" VARCHAR(40) NOT NULL,
    "totalAvailable" INTEGER NOT NULL DEFAULT 0,
    "allocated" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequirement" (
    "id" VARCHAR(30) NOT NULL,
    "requestId" VARCHAR(30) NOT NULL,
    "resourceId" VARCHAR(30) NOT NULL,
    "quantityNeeded" INTEGER NOT NULL,

    CONSTRAINT "ResourceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceAllocation" (
    "id" VARCHAR(30) NOT NULL,
    "requirementId" VARCHAR(30) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "ResourceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionTask" (
    "id" VARCHAR(30) NOT NULL,
    "requestId" VARCHAR(30) NOT NULL,
    "order" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "requiredSkills" TEXT[],
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
    "requiredResourceId" VARCHAR(30),
    "requiredResourceQuantity" INTEGER,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "blockedReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "prerequisiteTaskId" VARCHAR(30) NOT NULL,
    "dependentTaskId" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("prerequisiteTaskId","dependentTaskId")
);

-- CreateTable
CREATE TABLE "TaskPrerequisite" (
    "id" VARCHAR(30) NOT NULL,
    "taskId" VARCHAR(30) NOT NULL,
    "type" "DependencyType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "details" TEXT NOT NULL,
    "targetTaskId" VARCHAR(30),
    "targetResourceId" VARCHAR(30),

    CONSTRAINT "TaskPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerAssignment" (
    "id" VARCHAR(30) NOT NULL,
    "taskId" VARCHAR(30) NOT NULL,
    "volunteerId" VARCHAR(30) NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "VolunteerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutcomeConfirmation" (
    "id" VARCHAR(30) NOT NULL,
    "requestId" VARCHAR(30) NOT NULL,
    "confirmed" BOOLEAN NOT NULL,
    "feedback" TEXT,
    "disputed" BOOLEAN NOT NULL DEFAULT false,
    "disputeReason" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutcomeConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");

-- CreateIndex
CREATE INDEX "VolunteerProfile_availabilityStatus_verified_idx" ON "VolunteerProfile"("availabilityStatus", "verified");

-- CreateIndex
CREATE INDEX "VolunteerSkill_skill_idx" ON "VolunteerSkill"("skill");

-- CreateIndex
CREATE INDEX "VolunteerServiceArea_area_idx" ON "VolunteerServiceArea"("area");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityRequest_trackingCode_key" ON "CommunityRequest"("trackingCode");

-- CreateIndex
CREATE INDEX "CommunityRequest_status_urgency_createdAt_idx" ON "CommunityRequest"("status", "urgency", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityRequest_locationArea_createdAt_idx" ON "CommunityRequest"("locationArea", "createdAt");

-- CreateIndex
CREATE INDEX "Resource_category_name_idx" ON "Resource"("category", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_name_unit_key" ON "Resource"("name", "unit");

-- CreateIndex
CREATE INDEX "ResourceRequirement_resourceId_quantityNeeded_idx" ON "ResourceRequirement"("resourceId", "quantityNeeded");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceRequirement_requestId_resourceId_key" ON "ResourceRequirement"("requestId", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceAllocation_requirementId_status_idx" ON "ResourceAllocation"("requirementId", "status");

-- CreateIndex
CREATE INDEX "ActionTask_requestId_status_order_idx" ON "ActionTask"("requestId", "status", "order");

-- CreateIndex
CREATE INDEX "ActionTask_requiredResourceId_idx" ON "ActionTask"("requiredResourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTask_requestId_order_key" ON "ActionTask"("requestId", "order");

-- CreateIndex
CREATE INDEX "TaskDependency_dependentTaskId_idx" ON "TaskDependency"("dependentTaskId");

-- CreateIndex
CREATE INDEX "TaskPrerequisite_taskId_type_idx" ON "TaskPrerequisite"("taskId", "type");

-- CreateIndex
CREATE INDEX "TaskPrerequisite_targetTaskId_idx" ON "TaskPrerequisite"("targetTaskId");

-- CreateIndex
CREATE INDEX "VolunteerAssignment_taskId_status_idx" ON "VolunteerAssignment"("taskId", "status");

-- CreateIndex
CREATE INDEX "VolunteerAssignment_volunteerId_status_idx" ON "VolunteerAssignment"("volunteerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OutcomeConfirmation_requestId_key" ON "OutcomeConfirmation"("requestId");

-- AddForeignKey
ALTER TABLE "VolunteerProfile" ADD CONSTRAINT "VolunteerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerSkill" ADD CONSTRAINT "VolunteerSkill_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "VolunteerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerServiceArea" ADD CONSTRAINT "VolunteerServiceArea_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "VolunteerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityRequest" ADD CONSTRAINT "CommunityRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequirement" ADD CONSTRAINT "ResourceRequirement_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CommunityRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequirement" ADD CONSTRAINT "ResourceRequirement_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceAllocation" ADD CONSTRAINT "ResourceAllocation_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ResourceRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTask" ADD CONSTRAINT "ActionTask_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CommunityRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTask" ADD CONSTRAINT "ActionTask_requiredResourceId_fkey" FOREIGN KEY ("requiredResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_prerequisiteTaskId_fkey" FOREIGN KEY ("prerequisiteTaskId") REFERENCES "ActionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependentTaskId_fkey" FOREIGN KEY ("dependentTaskId") REFERENCES "ActionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPrerequisite" ADD CONSTRAINT "TaskPrerequisite_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ActionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPrerequisite" ADD CONSTRAINT "TaskPrerequisite_targetTaskId_fkey" FOREIGN KEY ("targetTaskId") REFERENCES "ActionTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPrerequisite" ADD CONSTRAINT "TaskPrerequisite_targetResourceId_fkey" FOREIGN KEY ("targetResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAssignment" ADD CONSTRAINT "VolunteerAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ActionTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAssignment" ADD CONSTRAINT "VolunteerAssignment_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "VolunteerProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce nonnegative inventory and quantity values at the database boundary.
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_inventory_nonnegative_check" CHECK ("totalAvailable" >= 0 AND "allocated" >= 0 AND "allocated" <= "totalAvailable");
ALTER TABLE "ResourceRequirement" ADD CONSTRAINT "ResourceRequirement_quantity_positive_check" CHECK ("quantityNeeded" > 0);
ALTER TABLE "ResourceAllocation" ADD CONSTRAINT "ResourceAllocation_quantity_positive_check" CHECK ("quantity" > 0);
ALTER TABLE "ActionTask" ADD CONSTRAINT "ActionTask_estimated_minutes_positive_check" CHECK ("estimatedMinutes" > 0);
ALTER TABLE "ActionTask" ADD CONSTRAINT "ActionTask_resource_quantity_positive_check" CHECK ("requiredResourceQuantity" IS NULL OR "requiredResourceQuantity" > 0);

-- A volunteer and a task may each have at most one active assignment.
CREATE UNIQUE INDEX "VolunteerAssignment_one_active_per_task" ON "VolunteerAssignment"("taskId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "VolunteerAssignment_one_active_per_volunteer" ON "VolunteerAssignment"("volunteerId") WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "OutcomeConfirmation" ADD CONSTRAINT "OutcomeConfirmation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CommunityRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
