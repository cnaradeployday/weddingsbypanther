import { Document, G, Page, Path, Svg } from "@react-pdf/renderer";
import { computeOutlineLayout, type OutlineLayoutParams } from "./personalizationOutline";
import { markupToPdfElements } from "./svgMarkupToPdf";

// Points-per-mm (1pt = 1/72in, 1in = 25.4mm) — the layout math in
// computeOutlineLayout is unit-agnostic, so feeding it canvas dimensions
// already converted to points makes every position/size it computes land
// directly in PDF point-space, matching the page size 1:1.
const PT_PER_MM = 72 / 25.4;

// The same print-ready artwork as buildOutlineArtworkSvg (personalization
// Outline.ts), as a true vector PDF instead — some print/laser shops want
// "curves in a PDF" specifically rather than a bare SVG file. Built from
// the identical shared layout (computeOutlineLayout) so the two exports
// can never disagree on where anything actually sits.
export async function buildOutlinePdfDocument(params: OutlineLayoutParams) {
  const { canvasW, canvasH } = params;
  const canvasWpt = canvasW * PT_PER_MM;
  const canvasHpt = canvasH * PT_PER_MM;
  const layout = await computeOutlineLayout({ ...params, canvasW: canvasWpt, canvasH: canvasHpt });

  return (
    <Document>
      <Page size={[canvasWpt, canvasHpt]} style={{ padding: 0 }}>
        <Svg width={canvasWpt} height={canvasHpt} viewBox={`0 0 ${canvasWpt} ${canvasHpt}`}>
          {layout.map((item, i) => {
            if (item.kind === "monogram") {
              return (
                <G
                  key={i}
                  transform={`translate(${item.cx} ${item.cy}) rotate(${item.rotationDeg}) scale(${item.scale}) translate(-12 -12)`}
                >
                  {markupToPdfElements(item.markup)}
                </G>
              );
            }
            if (item.kind === "frame") {
              return (
                <G
                  key={i}
                  transform={`translate(${item.cx} ${item.cy}) rotate(${item.rotationDeg}) scale(${item.scaleX} ${item.scaleY}) translate(-100 -45)`}
                >
                  {markupToPdfElements(item.markup)}
                </G>
              );
            }
            const paths = item.ds.map((d, j) => <Path key={j} d={d} fill={item.color} />);
            return item.rotationDeg ? (
              <G key={i} transform={`rotate(${item.rotationDeg} ${item.cx} ${item.cy})`}>
                {paths}
              </G>
            ) : (
              <G key={i}>{paths}</G>
            );
          })}
        </Svg>
      </Page>
    </Document>
  );
}
