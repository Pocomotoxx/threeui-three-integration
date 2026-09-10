import { useState } from "react";

// Embeds the sibling three.js-dev repository (served under /tjs/ by the
// dev-server middleware in vite.config.js) inside the ThreeUI shell, so the
// official three.js examples, editor, docs and manual live in one unified
// interface alongside the ThreeUI catalog.

type EngineTab = {
  id: string;
  label: string;
  src: string;
};

const TABS: readonly EngineTab[] = [
  { id: "examples", label: "Examples", src: "/tjs/examples/" },
  { id: "editor", label: "Editor", src: "/tjs/editor/" },
  { id: "docs", label: "Docs", src: "/tjs/docs/" },
  { id: "manual", label: "Manual", src: "/tjs/manual/#en/introduction/Creating-a-scene" },
];

export function ThreejsHub() {
  const [tab, setTab] = useState<EngineTab>(TABS[0]);

  return (
    <main
      aria-label="three.js engine"
      style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 57px)", minHeight: 0 }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          padding: "14px 20px",
          borderBottom: "1px solid rgba(128,128,128,0.25)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", marginRight: "auto" }}>
          <strong style={{ fontSize: 15 }}>three.js Engine</strong>
          <span style={{ fontSize: 12, opacity: 0.6 }}>
            Official examples, editor, docs and manual — powered by the local build (r0.186)
          </span>
        </div>
        <div role="tablist" aria-label="three.js sections" style={{ display: "flex", gap: 6 }}>
          {TABS.map((t) => {
            const active = t.id === tab.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  border: active ? "1px solid rgba(128,128,128,0.6)" : "1px solid rgba(128,128,128,0.25)",
                  background: active ? "rgba(128,128,128,0.28)" : "transparent",
                  color: "inherit",
                  opacity: active ? 1 : 0.75,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </header>
      <iframe
        key={tab.id}
        title={`three.js ${tab.label}`}
        src={tab.src}
        style={{ flex: 1, width: "100%", border: 0, minHeight: 0, background: "#000" }}
        allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
      />
    </main>
  );
}
