import type { StoredStatus } from "./access";

// DEMO ONLY — replaced by real database records in stage 2.
export const demoClients: {
  name: string; email: string; program: string; startsAt: string; endsAt: string; status: StoredStatus;
}[] = [
  { name: "Priya Sharma", email: "priya@example.com", program: "Executive Career Pivot", startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-12-01T00:00:00Z", status: "active" },
  { name: "Rahul Mehta", email: "rahul@example.com", program: "Job Search Sprint", startsAt: "2026-11-15T00:00:00Z", endsAt: "2027-01-15T00:00:00Z", status: "active" },
  { name: "Anita Rao", email: "anita@example.com", program: "Job Search Sprint", startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-09-01T00:00:00Z", status: "active" },
  { name: "Vikram Singh", email: "vikram@example.com", program: "Leadership Track", startsAt: "2026-08-01T00:00:00Z", endsAt: "2026-12-31T00:00:00Z", status: "suspended" },
  { name: "Neha Kapoor", email: "neha@example.com", program: "Job Search Sprint", startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z", status: "revoked" },
];

export const demoConversations = [
  { id: "c1", title: "Tailor resume for Product Lead role", updated: "Today" },
  { id: "c2", title: "LinkedIn headline rewrite", updated: "Yesterday" },
  { id: "c3", title: "Outreach note to hiring manager", updated: "Oct 20" },
];

export const capabilities = [
  "Resume optimization", "Job-description analysis", "LinkedIn profile", "Networking strategy", "Outreach messages", "Job-search plan",
];
