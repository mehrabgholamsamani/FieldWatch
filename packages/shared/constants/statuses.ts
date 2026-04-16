export enum ReportStatus {
  DRAFT = "DRAFT",
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  IN_REVIEW = "IN_REVIEW",
  RESOLVED = "RESOLVED",
  REJECTED = "REJECTED",
}

export enum Priority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum UserRole {
  REPORTER = "REPORTER",
  MANAGER = "MANAGER",
  ADMIN = "ADMIN",
}
