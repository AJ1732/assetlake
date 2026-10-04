const LANES = [
  {
    label: "Write",
    caption: "authenticated, once per image",
    steps: ["Browser", "App backend", "Sanity Content Lake"],
  },
  {
    label: "Read",
    caption: "every render, every size",
    steps: ["Browser", "cdn.sanity.io"],
  },
] as const;

export function FlowDiagram() {
  return (
    <figure className="flow" aria-labelledby="flow-caption">
      {LANES.map((lane) => (
        <div
          key={lane.label}
          className="flow-lane"
          data-lane={lane.label.toLowerCase()}
        >
          <div className="flow-lane-label">
            <span className="font-mono text-xs tracking-[0.2em] uppercase">
              {lane.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {lane.caption}
            </span>
          </div>
          <ol className="flow-steps">
            {lane.steps.map((step) => (
              <li key={step} className="flow-step">
                {step}
              </li>
            ))}
          </ol>
        </div>
      ))}
      <figcaption id="flow-caption" className="text-sm text-muted-foreground">
        The backend is on the write path only. After upload, no image byte
        passes through it.
      </figcaption>
    </figure>
  );
}
