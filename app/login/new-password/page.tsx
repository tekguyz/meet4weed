import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Choose a new password" };

/** Where a verified password-reset link lands. Under /login so it is public to
 *  the proxy; `setNewPassword` itself refuses a request with no session. */
export default function NewPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4">
      <h1 className="text-3xl">Choose a new password</h1>
      <NewPasswordForm />
    </main>
  );
}
