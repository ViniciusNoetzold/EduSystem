import { memo } from "react";

function GlassBackgroundComponent() {
  return (
    <div className="glass-background" aria-hidden="true">
      <span className="glass-blob glass-blob-cobalt" />
      <span className="glass-blob glass-blob-teal" />
      <span className="glass-blob glass-blob-violet" />
      <span className="glass-noise" />
    </div>
  );
}

const GlassBackground = memo(GlassBackgroundComponent);
export default GlassBackground;
