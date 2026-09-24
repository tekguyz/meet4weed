import { LegalPage, Placeholder, Section } from "@/components/legal/legal-page";

export const metadata = { title: "Community rules" };

export default function RulesPage() {
  return (
    <LegalPage title="Community rules">
      <Section title="Never buy or sell">
        <Placeholder>
          <p>
            No selling, no buying, no trading, no "who has some". Sharing at a sesh is fine; money for
            cannabis is not. Break this and the account is removed.
          </p>
        </Placeholder>
      </Section>

      <Section title="Respect the host">
        <Placeholder>
          <p>The host decides who comes. Keep the address to yourself.</p>
        </Placeholder>
      </Section>

      <Section title="Respect each other">
        <Placeholder>
          <p>No harassment. Bringing nothing is always fine.</p>
        </Placeholder>
      </Section>
    </LegalPage>
  );
}
