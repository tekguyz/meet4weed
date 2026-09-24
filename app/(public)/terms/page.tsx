import { LegalPage, Placeholder, Section } from "@/components/legal/legal-page";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <Section title="Who can join">
        <Placeholder>
          <p>Florida residents aged 21 or older who hold a valid Florida OMMU medical cannabis card.</p>
        </Placeholder>
      </Section>

      <Section title="No buying or selling">
        <Placeholder>
          <p>This app is a place to meet. It is never a place to buy, sell or trade cannabis.</p>
        </Placeholder>
      </Section>

      <Section title="Your account">
        <Placeholder>
          <p>What you agree to when you make an account, and when an account can be suspended.</p>
        </Placeholder>
      </Section>

      <Section title="Changes to these terms">
        <Placeholder>
          <p>How changes are announced. The app records which version you agreed to.</p>
        </Placeholder>
      </Section>
    </LegalPage>
  );
}
