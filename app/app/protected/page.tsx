import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";

export default async function ProtectedPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-8 max-w-2xl mx-auto">
        {/* Welcome Section */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Welcome back!</h1>
              <p className="text-muted-foreground mt-2">
                {user.email}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/auth/login">
                Sign out
              </Link>
            </Button>
          </div>

          <div className="space-y-4 text-muted-foreground">
            <p>
              We're glad to see you again! Your account was created on{' '}
              <span className="font-medium text-foreground">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
              .
            </p>
            <p>
              Last time you were here was{' '}
              <span className="font-medium text-foreground">
                {new Date().toLocaleString()}
              </span>
              .
            </p>
            <p>
              Ready to get started? You can access your dashboard and manage your account settings.
            </p>
          </div>

          <div className="flex gap-4">
            <Button asChild>
              <Link href="/candidates">
                Go to Candidates
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/settings">
                Account Settings
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
