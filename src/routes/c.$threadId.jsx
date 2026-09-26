import { createFileRoute, useParams } from "@tanstack/react-router";
import { ChatApp } from "@/components/chat/ChatApp";

export const Route = createFileRoute("/c/$threadId")({
  component: ThreadRoute,
});

function ThreadRoute() {
  const params = useParams({ strict: false });
  return <ChatApp threadId={params?.threadId} />;
}
