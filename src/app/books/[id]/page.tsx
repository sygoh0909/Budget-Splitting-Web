"use client";

import { useParams } from "next/navigation";
import { BookDetailScreen } from "@/components/BookDetailScreen";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <BookDetailScreen bookId={id} />;
}
