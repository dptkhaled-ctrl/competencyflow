import { redirect } from "next/navigation";

export default async function StaffLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/staff?lesson=${id}`);
}