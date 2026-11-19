import { forwardRef } from "react";

import {
  OLIVIA_DOT_1,
  OLIVIA_DOT_2,
  OLIVIA_FINAL_SCALE,
  OLIVIA_LIVIA,
  OLIVIA_O,
  OLIVIA_VIEWBOX,
} from "./olivia-paths";

/**
 * "Olivia" logotipi (vektor). Kirish animatsiyasi oxiridagi holat bilan bir xil ramkada
 * chiziladi (markazdan `OLIVIA_FINAL_SCALE` masshtabda) — shuning uchun animatsiyadagi yozuv
 * shu element o'rniga aynan ustma-ust "qo'nadi".
 */
export const OliviaWordmark = forwardRef<SVGSVGElement, { className?: string; color?: string }>(
  function OliviaWordmark({ className, color = "#df3425" }, ref) {
    return (
      <svg ref={ref} viewBox={OLIVIA_VIEWBOX} className={className} role="img" aria-label="Olivia">
        <g transform={`translate(380 158) scale(${OLIVIA_FINAL_SCALE}) translate(-380 -158)`} fill={color}>
          <path d={OLIVIA_O} fillRule="evenodd" />
          <path d={OLIVIA_LIVIA} fillRule="evenodd" />
          <path d={OLIVIA_DOT_1} />
          <path d={OLIVIA_DOT_2} />
        </g>
      </svg>
    );
  },
);
