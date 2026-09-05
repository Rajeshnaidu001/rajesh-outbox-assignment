import { EmailsTable } from "./EmailsTable";

export function ScheduledTable({ searchQuery, refreshToken }: { searchQuery: string; refreshToken: number }) {
  return <EmailsTable kind="scheduled" searchQuery={searchQuery} refreshToken={refreshToken} />;
}
