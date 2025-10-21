// ProgressBar removed from UI
import Prompt from "./prompt";
import { getServerSession } from "next-auth";
import { opts } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { getUserByEmail } from "@/lib/slack";

// Hackatime Setup Page (/launchpad/intro/hackatime)
// Guides and confirms the logged in users hackatime account and hackatime heartbeat
export default async function Page() {
  const session = await getServerSession(opts);

  if (!session || !session?.user || !session.user.email) redirect("/launchpad/login");
  const slackId = await getUserByEmail(session!.user!.email).then((d) => d!.id);

  return (
    <>
      <div className="flex flex-col items-center justify-center h-[100vh] w-[100vw] bg-[url(/hut.webp)]">
        <img src="/logo-outline.svg" className="w-92 mb-4"></img>
        <div className="w-92 text-xs text-white/70">Progress hidden</div>
        <Prompt slackId={slackId!}></Prompt>
      </div>
    </>
  );
}
