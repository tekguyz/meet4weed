import { LegalPage, Placeholder, Section } from "@/components/legal/legal-page";
import { FOCUS_RING } from "@/components/ui/focus";

export const metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <LegalPage title="Help">
      <Section title="How verification works">
        <Placeholder>
          <p>
            You photograph your OMMU card and take a short face check. A person looks at both and
            decides. A computer reads the card first to help that person, but it never approves anyone.
          </p>
        </Placeholder>
      </Section>

      <Section title="Why a card is rejected">
        <Placeholder>
          <p>
            The common reasons: the photo is blurred or cut off, the card has expired, the name does not
            match, or the face check does not match the card.
          </p>
        </Placeholder>
      </Section>

      <Section title="The fuzzy circle, and when the address unlocks">
        <Placeholder>
          <p>
            Before you are let in, a sesh shows only a rough circle on the map, never the house. The host
            decides who comes. When the host says yes to you, the exact address unlocks.
          </p>
        </Placeholder>
      </Section>

      <Section title="What happens to your card and face photos">
        <Placeholder>
          <p>
            Both photos are deleted when a person decides on your card. Anything left over is deleted
            after 7 days, whatever happens.
          </p>
        </Placeholder>
      </Section>

      <Section title="Contact">
        <p className="text-sm text-ink">
          Something wrong, or a question this page does not answer? Email{" "}
          <a href="mailto:contact@tekguyz.com" className={`text-primary underline ${FOCUS_RING}`}>
            contact@tekguyz.com
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
