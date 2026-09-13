"use client";

// Barra de controles táctiles compartida por los 4 motores reales (SPEC 10).
// No conoce nada específico de ningún juego: solo dibuja botones a partir de
// `dpad`/`actions` y reenvía el `code` (mismo valor que KeyboardEvent.code)
// a través de `onPress`/`onRelease`. Permanece en el DOM siempre; la visibilidad
// la decide únicamente el CSS de `.touch-controls` vía `@media (pointer: coarse)`.

export interface TouchButtonConfig {
  code: string; // mismo valor que KeyboardEvent.code, p.ej. "ArrowLeft"
  label: string; // texto/símbolo del botón, p.ej. "◀", "⟳", "⤓", "●"
}

export interface TouchControlsProps {
  dpad: TouchButtonConfig[]; // 1 a 4 entradas
  actions: TouchButtonConfig[]; // 0 a 2 entradas
  onPress: (code: string) => void;
  onRelease: (code: string) => void;
}

export function TouchControls({
  dpad,
  actions,
  onPress,
  onRelease,
}: TouchControlsProps) {
  return (
    <div className="touch-controls">
      <div className="touch-dpad">
        {dpad.map((btn) => (
          <button
            key={btn.code}
            type="button"
            className={`touch-btn touch-dpad-${btn.code}`}
            onPointerDown={(e) => {
              e.preventDefault();
              onPress(btn.code);
            }}
            onPointerUp={() => onRelease(btn.code)}
            onPointerLeave={() => onRelease(btn.code)}
            onPointerCancel={() => onRelease(btn.code)}
          >
            {btn.label}
          </button>
        ))}
      </div>
      {actions.length > 0 && (
        <div className="touch-actions">
          {actions.map((btn) => (
            <button
              key={btn.code}
              type="button"
              className="touch-btn touch-action-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                onPress(btn.code);
              }}
              onPointerUp={() => onRelease(btn.code)}
              onPointerLeave={() => onRelease(btn.code)}
              onPointerCancel={() => onRelease(btn.code)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
