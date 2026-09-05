import { EmailsTable } from "./EmailsTable";

interface Props {
  searchQuery: string;
  refreshToken: number;
  statusFilter: string;
}

export function ScheduledTable({ searchQuery, refreshToken, statusFilter }: Props) {
  return <EmailsTable kind="scheduled" searchQuery={searchQuery} refreshToken={refreshToken} statusFilter={statusFilter} />;
}
