import { EmailsTable } from "./EmailsTable";

interface Props {
  searchQuery: string;
  refreshToken: number;
  statusFilter: string;
}

export function SentTable({ searchQuery, refreshToken, statusFilter }: Props) {
  return <EmailsTable kind="sent" searchQuery={searchQuery} refreshToken={refreshToken} statusFilter={statusFilter} />;
}
