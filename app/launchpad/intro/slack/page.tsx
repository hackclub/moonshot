// ProgressBar removed from UI
import Prompt from "./prompt";
import { getServerSession } from "next-auth";
import { opts } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

// Slack Setup Page (/launchpad/intro/slack)
// Guides and confirms the registration of the users in the slack
export default async function Page() {
  const session = await getServerSession(opts);

  if (!session || !session?.user || !session.user.email) redirect("/launchpad/login");

  return (
    <>
      <div className="flex flex-col items-center justify-center h-[100vh] w-[100vw] bg-[url(/hut.webp)]">
        <img src="/logo-outline.svg" className="w-102 mb-4"></img>
        <div className="w-102 text-xs text-white/70">Progress hidden</div>
        <Prompt email={session.user!.email!}></Prompt>
      </div>
    </>
  );
}
