export function VideoRef() {
  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <video
        src="/__mockup/videos/streak-ref.mp4"
        autoPlay
        loop
        muted
        playsInline
        controls
        style={{ maxWidth: "100%", maxHeight: "100vh" }}
      />
    </div>
  );
}
