import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AddressPanel } from "@/components/sesh/address-panel";

/** The panel renders what the database handed it and decides nothing.
 *
 *  That is the whole point of these tests. `sesh_address()` returns the
 *  address or no rows, and no rows IS the locked state — not an error, and
 *  not something a screen works out. The day somebody adds `if (isApproved)`
 *  here, the decision has left Postgres and this file should stop them.
 */
const ADDRESS = {
  addressLine: "1 Test Street",
  unitNote: "Apt 4",
  gateCode: "1234",
  exactLat: 27.9506,
  exactLng: -82.4572,
};

describe("AddressPanel", () => {
  it("shows the street, the unit and the gate code when it was given one", () => {
    render(<AddressPanel address={ADDRESS} areaName="Riverside" />);

    expect(screen.getByText(/1 Test Street/)).toBeInTheDocument();
    expect(screen.getByText(/Apt 4/)).toBeInTheDocument();
    expect(screen.getByText(/1234/)).toBeInTheDocument();
  });

  it("leaves out a unit and a gate code the host did not give", () => {
    render(
      <AddressPanel address={{ ...ADDRESS, unitNote: null, gateCode: null }} areaName="Riverside" />,
    );

    expect(screen.getByText(/1 Test Street/)).toBeInTheDocument();
    expect(screen.queryByText(/gate/i)).not.toBeInTheDocument();
  });

  /** Nothing was handed over, so nothing is shown. The component is not told
   *  why, and must not ask. */
  it("shows the locked state when it was given nothing", () => {
    render(<AddressPanel address={null} areaName="Riverside" />);

    expect(screen.queryByText(/1 Test Street/)).not.toBeInTheDocument();
    expect(screen.getByText(/approve/i)).toBeInTheDocument();
  });

  it("still names the area when locked, so a member can judge the trip", () => {
    render(<AddressPanel address={null} areaName="Riverside" />);

    expect(screen.getByText(/Riverside/)).toBeInTheDocument();
  });

  it("copes with a sesh that has no area name yet", () => {
    render(<AddressPanel address={null} areaName={null} />);

    expect(screen.getByText(/approve/i)).toBeInTheDocument();
  });

  /** After the 7-day wipe (#10) there is a row but no address in it. The
   *  panel must not print "null" at somebody. */
  it("says the address is gone once it has been wiped", () => {
    render(
      <AddressPanel
        address={{ addressLine: null, unitNote: null, gateCode: null, exactLat: null, exactLng: null }}
        areaName="Riverside"
      />,
    );

    expect(screen.queryByText(/null/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no longer stored/i)).toBeInTheDocument();
  });
});
