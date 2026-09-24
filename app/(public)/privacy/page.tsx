import { LegalPage, Placeholder, Section } from "@/components/legal/legal-page";
import { FOCUS_RING } from "@/components/ui/focus";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <Section title="What we keep">
        <Placeholder>
          <p>Your email, your profile, your card's expiry date, and the seshes you host or join.</p>
        </Placeholder>
      </Section>

      <Section title="Card and face photos">
        <Placeholder>
          <p>
            Deleted when a person decides on your card, and never kept longer than 7 days. A computer
            reads the card to help that person; it does not decide.
          </p>
        </Placeholder>
      </Section>

      <Section title="Your address">
        <Placeholder>
          <p>A sesh address is shown only to members the host has said yes to.</p>
        </Placeholder>
      </Section>

      <Section title="Contact">
        <p className="text-sm text-ink">
          Questions about your data? Email{" "}
          <a href="mailto:contact@tekguyz.com" className={`text-primary underline ${FOCUS_RING}`}>
            contact@tekguyz.com
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
