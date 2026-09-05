import { EmailsTable } from "./EmailsTable";

export function SentTable({ searchQuery, refreshToken }: { searchQuery: string; refreshToken: number }) {
  return <EmailsTable kind="sent" searchQuery={searchQuery} refreshToken={refreshToken} />;
}
