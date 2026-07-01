import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/routes/index";
import { UNIVERSITY_SHORT_NAME } from "@/lib/brand";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: `Admin sign in - ${UNIVERSITY_SHORT_NAME}` },
      {
        name: "description",
        content: `Restricted administrator sign in for ${UNIVERSITY_SHORT_NAME}.`,
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  return <LoginPage portal="admin" />;
}
