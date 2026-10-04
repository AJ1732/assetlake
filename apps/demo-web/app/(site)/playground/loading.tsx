export default function PlaygroundLoading() {
  return (
    <div
      className="playground"
      aria-busy="true"
      aria-label="Loading the playground"
    >
      <div className="panel skeleton playground-skeleton-card" />
      <div className="matrix-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="matrix-cell skeleton">
            <div className="matrix-frame" />
            <span className="skeleton-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
