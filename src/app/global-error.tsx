"use client";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#f8fafc", color: "#0f172a", fontFamily: "Segoe UI, system-ui, sans-serif" }}>
        <title>Error del sistema | ERP Grasas y Lubricantes</title>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, boxSizing: "border-box" }}>
          <section
            role="alert"
            style={{
              width: "100%",
              maxWidth: 520,
              boxSizing: "border-box",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              background: "#ffffff",
              padding: 32,
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div aria-hidden="true" style={{ fontSize: 36, lineHeight: 1 }}>!</div>
            <h1 style={{ margin: "20px 0 0", fontSize: 26 }}>El sistema no pudo iniciar correctamente</h1>
            <p style={{ margin: "12px auto 0", maxWidth: 420, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
              Intente cargar nuevamente. Si el problema continúa, comunique la referencia al administrador.
            </p>
            {error.digest && (
              <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: 12 }}>
                Referencia: <code>{error.digest}</code>
              </p>
            )}
            <button
              type="button"
              onClick={() => retry()}
              style={{
                marginTop: 24,
                minHeight: 42,
                border: 0,
                borderRadius: 8,
                background: "#2563eb",
                color: "#ffffff",
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Volver a intentar
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
