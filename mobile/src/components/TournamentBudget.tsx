import React, { useState } from "react";
import { Button, Card, C, ErrorBox, Field, Row, Txt } from "./ui";
import { tournamentBudget } from "../lib/tournamentBudget";
export default function TournamentBudget() {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState("20");
  const [count, setCount] = useState("8");
  const [host, setHost] = useState("10");
  const [platform, setPlatform] = useState("5");
  let budget: ReturnType<typeof tournamentBudget> | undefined;
  let error: unknown;
  try {
    budget = tournamentBudget(
      Math.round(Number(entry) * 100),
      Number(count),
      Math.round(Number(platform) * 100),
      Math.round(Number(host) * 100),
    );
  } catch (e) {
    error = e;
  }
  const money = (c: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(c / 100);
  return (
    <Card>
      <Button
        title={open ? "Close budget planner" : "Plan a future paid tournament"}
        kind="ghost"
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <Txt bold>Budget estimate</Txt>
          <Txt size={13} color={C.muted}>
            Model entry fees and both commissions. These are example rates you
            can adjust, not a published payment offer.
          </Txt>
          <Field
            label="Entry fee per team (USD)"
            value={entry}
            onChangeText={setEntry}
            keyboardType="decimal-pad"
          />
          <Field
            label="Paid teams"
            value={count}
            onChangeText={setCount}
            keyboardType="number-pad"
          />
          <Field
            label="SpotUp commission (%)"
            value={platform}
            onChangeText={setPlatform}
            keyboardType="decimal-pad"
          />
          <Field
            label="Host commission (%)"
            value={host}
            onChangeText={setHost}
            keyboardType="decimal-pad"
          />
          {budget &&
            Object.entries({
              "Total entries": budget.gross,
              "SpotUp share": budget.platform,
              "Host share": budget.host,
              "Remaining event budget": budget.remainder,
            }).map(([label, value]) => (
              <Row key={label} style={{ justifyContent: "space-between" }}>
                <Txt>{label}</Txt>
                <Txt bold>{money(value)}</Txt>
              </Row>
            ))}
          <ErrorBox error={error} />
          <Txt size={12} color={C.muted}>
            Planning only. Processing fees, refunds, taxes, and event costs are
            not included. Current tournaments remain free to enter; paid
            registration and payouts are not enabled.
          </Txt>
        </>
      )}
    </Card>
  );
}
