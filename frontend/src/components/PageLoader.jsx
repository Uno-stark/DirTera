function PageLoader() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
      }}
    >
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading…</p>
    </div>
  );
}

export default PageLoader;
