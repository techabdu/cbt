import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Public landing page. Staff sign in via /login; students take exams on the
 * offline server at /exam/login. Authenticated redirects are handled in the
 * dashboard layout once the session is known on the client.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          CBT System
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Computer-Based Testing for the College of Education. Staff sign in to
          manage exams, questions, and results.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/login">Staff Sign In</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/exam/login">Student Exam</Link>
        </Button>
      </div>
    </main>
  );
}
