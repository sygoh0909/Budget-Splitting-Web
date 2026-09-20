"use client";

import { useParams } from "next/navigation";
import { EditBookScreen } from "@/components/EditBookScreen";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <EditBookScreen bookId={id} />;
}
