import "./BunnyLoader.css";

const BunnyLoader = () => {
  return (
    <div className="bunny-loader" role="status" aria-live="polite" aria-label="Loading">
      <div className="rabbit-background" aria-hidden="true" />
      <div className="bunny-loader__stage">
        <div className="rabbit" aria-hidden="true" />
        <div className="clouds" aria-hidden="true" />
      </div>
    </div>
  );
};

export default BunnyLoader;
