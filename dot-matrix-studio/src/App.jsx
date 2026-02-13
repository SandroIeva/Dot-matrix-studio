import { useState, useRef, useCallback, useEffect } from "react";

function SliderControl({ label, value, onChange, min, max, step = 1 }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);
  const pct = ((value - min) / (max - min)) * 100;

  const computeValue = useCallback((clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.max(min, Math.min(max, Math.round((min + (x / rect.width) * (max - min)) / step) * step));
  }, [min, max, step]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      onChange(computeValue(e.clientX));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [computeValue, onChange]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "#888", letterSpacing: "0.04em" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#333", fontFamily: "monospace" }}>{value}</span>
      </div>
      <div
        ref={trackRef}
        onPointerDown={(e) => { e.preventDefault(); dragging.current = true; onChange(computeValue(e.clientX)); }}
        style={{
          position: "relative", height: 28, cursor: "pointer",
          display: "flex", alignItems: "center", touchAction: "none", userSelect: "none",
        }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, height: 3, borderRadius: 2, background: "#e5e5e5" }} />
        <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 3, borderRadius: 2, background: "#222", pointerEvents: "none" }} />
        <div style={{
          position: "absolute", left: `${pct}%`, transform: "translateX(-50%)",
          width: 16, height: 16, borderRadius: "50%",
          background: "#222", border: "2px solid #fff",
          boxShadow: "0 0 0 1px #ccc, 0 1px 3px rgba(0,0,0,0.15)", pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}

const Label = ({ children }) => (
  <span style={{ fontSize: 11, fontWeight: 500, color: "#888", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>{children}</span>
);

export default function DotLogoTool() {
  const [dotSize, setDotSize] = useState(10);
  const [spacing, setSpacing] = useState(10);
  const [threshold, setThreshold] = useState(128);
  const [colorMode, setColorMode] = useState("original");
  const [customColor, setCustomColor] = useState("#000000");
  const [panelBg, setPanelBg] = useState("#ffffff");
  const [shape, setShape] = useState("circle");
  const [halftones, setHalftones] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [showControls, setShowControls] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const canvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const processImage = useCallback((src) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const hidden = hiddenCanvasRef.current;
      const maxW = 800;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);
      hidden.width = w; hidden.height = h;
      const ctx = hidden.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      setImageData({ data: ctx.getImageData(0, 0, w, h), width: w, height: h });
    };
    img.src = src;
  }, []);

  const drawDots = useCallback(() => {
    if (!imageData) return;
    const canvas = canvasRef.current;
    const { data, width, height } = imageData;
    const pixels = data.data;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    const step = dotSize + spacing;
    if (step < 1) return;
    const radius = dotSize / 2;
    for (let y = Math.floor(step / 2); y < height; y += step) {
      for (let x = Math.floor(step / 2); x < width; x += step) {
        const px = Math.min(x, width - 1), py = Math.min(y, height - 1);
        const i = (py * width + px) * 4;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (a < 30) continue;
        if (brightness > threshold && colorMode !== "original") continue;
        let fillColor;
        if (colorMode === "original") {
          if (brightness > threshold && a < 200) continue;
          fillColor = halftones ? `rgba(${r},${g},${b},${a / 255})` : `rgb(${r},${g},${b})`;
        } else if (colorMode === "mono") { fillColor = customColor; }
        else { fillColor = halftones ? `rgba(${r},${g},${b},${a / 255})` : `rgb(${r},${g},${b})`; }
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        if (shape === "circle") ctx.arc(x, y, radius, 0, Math.PI * 2);
        else if (shape === "square") ctx.rect(x - radius, y - radius, dotSize, dotSize);
        else { ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius, y); ctx.closePath(); }
        ctx.fill();
      }
    }
  }, [imageData, dotSize, spacing, threshold, colorMode, customColor, halftones, shape]);

  useEffect(() => { drawDots(); }, [drawDots]);

  const handleFile = (file) => {
    if (!file) return;
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = (e) => processImage(URL.createObjectURL(new Blob([e.target.result], { type: "image/svg+xml;charset=utf-8" })));
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => processImage(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); };

  const handleExport = () => {
    if (!imageData) return;
    const { width, height } = imageData;
    const exp = document.createElement("canvas");
    exp.width = width; exp.height = height;
    const ctx = exp.getContext("2d");
    ctx.fillStyle = panelBg; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(canvasRef.current, 0, 0);
    const link = document.createElement("a");
    link.download = "dot-logo.png"; link.href = exp.toDataURL("image/png"); link.click();
  };

  const handleExportTransparent = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "dot-logo-transparent.png"; link.href = canvasRef.current.toDataURL("image/png"); link.click();
  };

  const handleExportSVG = () => {
    if (!imageData) return;
    const { data, width, height } = imageData;
    const pixels = data.data;
    const step = dotSize + spacing, radius = dotSize / 2;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += `<rect width="${width}" height="${height}" fill="${panelBg}"/>`;
    for (let y = Math.floor(step / 2); y < height; y += step) {
      for (let x = Math.floor(step / 2); x < width; x += step) {
        const px = Math.min(x, width - 1), py = Math.min(y, height - 1);
        const i = (py * width + px) * 4;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (a < 30) continue;
        if (brightness > threshold && colorMode !== "original") continue;
        let fill;
        if (colorMode === "original") {
          if (brightness > threshold && a < 200) continue;
          fill = halftones ? `rgba(${r},${g},${b},${(a / 255).toFixed(2)})` : `rgb(${r},${g},${b})`;
        } else if (colorMode === "mono") { fill = customColor; }
        else { fill = halftones ? `rgba(${r},${g},${b},${(a / 255).toFixed(2)})` : `rgb(${r},${g},${b})`; }
        if (shape === "circle") svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`;
        else if (shape === "square") svg += `<rect x="${x - radius}" y="${y - radius}" width="${dotSize}" height="${dotSize}" fill="${fill}"/>`;
        else svg += `<polygon points="${x},${y - radius} ${x + radius},${y} ${x},${y + radius} ${x - radius},${y}" fill="${fill}"/>`;
      }
    }
    svg += `</svg>`;
    const link = document.createElement("a");
    link.download = "dot-logo.svg"; link.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); link.click();
  };

  const BG_COLORS = ["#ffffff", "#f5f5f4", "#e7e5e4", "#1c1917", "#000000", "#0f172a"];

  const pillBtn = (active) => ({
    padding: "6px 11px", border: "1px solid",
    borderColor: active ? "#222" : "#e0e0e0",
    borderRadius: 6, cursor: "pointer",
    background: active ? "#222" : "#fff",
    color: active ? "#fff" : "#666",
    fontSize: 11, fontWeight: 500,
  });

  const checkBtn = (active) => ({
    padding: "6px 10px", border: "1px solid",
    borderColor: active ? "#222" : "#e0e0e0",
    borderRadius: 6, cursor: "pointer", textAlign: "left",
    background: active ? "#fafafa" : "#fff",
    color: active ? "#222" : "#999",
    fontSize: 11, fontWeight: 500,
    display: "flex", alignItems: "center", gap: 7,
  });

  const checkBox = (active) => ({
    width: 14, height: 14, borderRadius: 3, flexShrink: 0,
    background: active ? "#222" : "#fff",
    border: active ? "none" : "1.5px solid #ccc",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 9, color: "#fff", lineHeight: 1,
  });

  // Shared controls content
  const Controls = () => (
    <>
      <SliderControl label="Dot Size" value={dotSize} onChange={setDotSize} min={1} max={20} />
      <SliderControl label="Spacing" value={spacing} onChange={setSpacing} min={0} max={20} />
      <SliderControl label="Threshold" value={threshold} onChange={setThreshold} min={0} max={255} />

      <div style={{ marginBottom: 16 }}>
        <Label>Shape</Label>
        <div style={{ display: "flex", gap: 5 }}>
          {[{ id: "circle", icon: "●" }, { id: "square", icon: "■" }, { id: "diamond", icon: "◆" }].map((s) => (
            <button key={s.id} onClick={() => setShape(s.id)} style={{
              ...pillBtn(shape === s.id), flex: 1, fontSize: 13, padding: "6px 0",
            }}>{s.icon}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label>Color</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {[{ id: "original", label: "Original" }, { id: "colored", label: "Filtered" }, { id: "mono", label: "Mono" }].map((m) => (
            <button key={m.id} onClick={() => setColorMode(m.id)} style={pillBtn(colorMode === m.id)}>{m.label}</button>
          ))}
        </div>
      </div>

      {colorMode === "mono" && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)}
            style={{ width: 28, height: 28, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", padding: 0, background: "transparent" }} />
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#999" }}>{customColor}</span>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <button onClick={() => setHalftones(!halftones)} style={checkBtn(halftones)}>
          <span style={checkBox(halftones)}>{halftones ? "✓" : ""}</span>
          Halftones
        </button>
      </div>

      <div style={{ height: 1, background: "#eee", margin: "2px 0 14px" }} />

      <div style={{ marginBottom: 16 }}>
        <Label>Background</Label>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {BG_COLORS.map((c) => (
            <button key={c} onClick={() => setPanelBg(c)} style={{
              width: 28, height: 28, borderRadius: 6, cursor: "pointer", background: c,
              border: panelBg === c ? "2px solid #222" : "1.5px solid #ddd",
              boxShadow: panelBg === c ? "0 0 0 1px #222" : "none",
            }} />
          ))}
          <input type="color" value={panelBg} onChange={(e) => setPanelBg(e.target.value)}
            style={{ width: 28, height: 28, border: "1.5px solid #ddd", borderRadius: 6, cursor: "pointer", padding: 0, background: "transparent" }} />
        </div>
      </div>

      {imageData && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={handleExport} style={{
            padding: "9px 14px", border: "none", borderRadius: 7, cursor: "pointer",
            background: "#222", color: "#fff", fontSize: 11, fontWeight: 600,
          }}>↓ Export PNG</button>
          <button onClick={handleExportTransparent} style={{
            padding: "9px 14px", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer",
            background: "#fff", color: "#555", fontSize: 11, fontWeight: 500,
          }}>↓ Transparent PNG</button>
          <button onClick={handleExportSVG} style={{
            padding: "9px 14px", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer",
            background: "#fff", color: "#555", fontSize: 11, fontWeight: 500,
          }}>↓ Export SVG</button>
        </div>
      )}
    </>
  );

  return (
    <div style={{
      height: "100vh", background: "#fafafa",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#222", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: isMobile ? "10px 14px" : "10px 20px",
        borderBottom: "1px solid #eee", background: "#fff",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, zIndex: 20,
      }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 13 : 14, fontWeight: 600, letterSpacing: "-0.01em", color: "#111", fontFamily: "'JetBrains Mono', monospace" }}>
          Dot Matrix Studio
        </h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isMobile && imageData && (
            <button onClick={() => setShowControls(!showControls)} style={{
              padding: "5px 12px", borderRadius: 6, cursor: "pointer",
              background: showControls ? "#222" : "#fff",
              border: "1px solid #e0e0e0",
              color: showControls ? "#fff" : "#555",
              fontSize: 11, fontWeight: 500,
            }}>
              {showControls ? "Done" : "Settings"}
            </button>
          )}
          {imageData && (
            <button onClick={() => { setImageData(null); setShowControls(false); }} style={{
              padding: "5px 12px", borderRadius: 6, cursor: "pointer",
              background: "#fff", border: "1px solid #e0e0e0",
              color: "#999", fontSize: 11, fontWeight: 500,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#e44"; e.currentTarget.style.borderColor = "#e44"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#999"; e.currentTarget.style.borderColor = "#e0e0e0"; }}
            >Remove</button>
          )}
        </div>
      </div>

      {/* Desktop layout */}
      {!isMobile && (
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={{
            width: 232, flexShrink: 0, padding: "18px 16px",
            borderRight: "1px solid #eee", background: "#fff", overflowY: "auto",
          }}>
            <Controls />
          </div>
          <div
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "auto", backgroundColor: panelBg, transition: "background-color 0.2s ease",
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <canvas ref={hiddenCanvasRef} style={{ display: "none" }} />
            {!imageData ? (
              <div onClick={() => fileInputRef.current?.click()} style={{
                width: "100%", maxWidth: 420, aspectRatio: "4/3",
                border: `1.5px dashed ${isDragging ? "#222" : "#ccc"}`,
                borderRadius: 14, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, background: "rgba(255,255,255,0.6)", margin: 32,
              }}>
                <div style={{ fontSize: 28, color: "#bbb", lineHeight: 1 }}>⠿</div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#999" }}>Drop your logo / icon here</p>
                <p style={{ margin: 0, fontSize: 11, color: "#bbb" }}>PNG or SVG</p>
                <input ref={fileInputRef} type="file" accept=".png,.svg,image/png,image/svg+xml"
                  style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
              </div>
            ) : (
              <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%", display: "block" }} />
            )}
          </div>
        </div>
      )}

      {/* Mobile layout */}
      {isMobile && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
          {/* Canvas area */}
          <div
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "auto", backgroundColor: panelBg, transition: "background-color 0.2s ease",
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <canvas ref={hiddenCanvasRef} style={{ display: "none" }} />
            {!imageData ? (
              <div onClick={() => fileInputRef.current?.click()} style={{
                width: "calc(100% - 48px)", maxWidth: 360, aspectRatio: "4/3",
                border: `1.5px dashed ${isDragging ? "#222" : "#ccc"}`,
                borderRadius: 14, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, background: "rgba(255,255,255,0.6)", margin: 24,
              }}>
                <div style={{ fontSize: 28, color: "#bbb", lineHeight: 1 }}>⠿</div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#999" }}>Drop your logo / icon here</p>
                <p style={{ margin: 0, fontSize: 11, color: "#bbb" }}>PNG or SVG</p>
                <input ref={fileInputRef} type="file" accept=".png,.svg,image/png,image/svg+xml"
                  style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
              </div>
            ) : (
              <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%", display: "block", padding: 12 }} />
            )}
          </div>

          {/* Mobile bottom sheet */}
          {showControls && (
            <>
              <div
                onClick={() => setShowControls(false)}
                style={{
                  position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 30,
                }}
              />
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 31,
                background: "#fff", borderTop: "1px solid #eee",
                borderRadius: "16px 16px 0 0",
                maxHeight: "70vh", overflowY: "auto",
                padding: "20px 18px",
                boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
              }}>
                {/* Drag handle */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: "#ddd" }} />
                </div>
                <Controls />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
