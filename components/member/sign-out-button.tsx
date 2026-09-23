import { Button } from "@/components/ui/button";

/** Sign out of this device. A POST, never a link: a GET sign-out can be fired
 *  by an <img> tag on any page the member visits. */
export function SignOutButton() {
  return (
    <form action="/auth/sign-out" method="post">
      <Button type="submit" variant="quiet">
        Sign out
      </Button>
    </form>
  );
}
