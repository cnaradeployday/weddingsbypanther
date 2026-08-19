import { Circle, Ellipse, Path, Polygon, Rect } from "@react-pdf/renderer";

// monograms.ts and frameTemplates.ts emit a flat (no nested <g>) string of
// plain SVG primitives — <path>, <circle>, <ellipse>, <rect>, <polygon> —
// meant for a browser's dangerouslySetInnerHTML. The print-ready PDF export
// needs those same shapes as react-pdf JSX elements instead of markup, so
// this parses that known, self-generated markup (never untrusted input)
// into the matching react-pdf primitive per tag, passing through
// fill/stroke/opacity/transform. A regex parser is fine here specifically
// because the source is always our own small, flat, self-closing-tag
// output — not arbitrary/attacker-controlled SVG.
const TAG_RE = /<(path|circle|ellipse|rect|polygon)\s+([^>]*?)\/?>/g;
const ATTR_RE = /([\w-]+)="([^"]*)"/g;

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(raw))) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

// Shared SVG presentation attributes every primitive below accepts,
// converted from the markup's kebab-case to react-pdf's camelCase props.
function presentationProps(attrs: Record<string, string>) {
  const props: Record<string, string | number> = {};
  if (attrs.fill !== undefined) props.fill = attrs.fill;
  if (attrs.stroke !== undefined) props.stroke = attrs.stroke;
  if (attrs["stroke-width"] !== undefined) props.strokeWidth = Number(attrs["stroke-width"]);
  if (attrs["stroke-linecap"] !== undefined) props.strokeLinecap = attrs["stroke-linecap"];
  if (attrs["stroke-linejoin"] !== undefined) props.strokeLinejoin = attrs["stroke-linejoin"];
  if (attrs.opacity !== undefined) props.opacity = Number(attrs.opacity);
  if (attrs.transform !== undefined) props.transform = attrs.transform;
  return props;
}

export function markupToPdfElements(markup: string): React.ReactElement[] {
  const elements: React.ReactElement[] = [];
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  let i = 0;
  while ((m = TAG_RE.exec(markup))) {
    const tag = m[1];
    const attrs = parseAttrs(m[2]);
    const key = `${tag}-${i++}`;
    const common = presentationProps(attrs);
    switch (tag) {
      case "path":
        if (attrs.d) elements.push(<Path key={key} d={attrs.d} {...common} />);
        break;
      case "circle":
        elements.push(
          <Circle key={key} cx={Number(attrs.cx)} cy={Number(attrs.cy)} r={Number(attrs.r)} {...common} />
        );
        break;
      case "ellipse":
        elements.push(
          <Ellipse
            key={key}
            cx={Number(attrs.cx)}
            cy={Number(attrs.cy)}
            rx={Number(attrs.rx)}
            ry={Number(attrs.ry)}
            {...common}
          />
        );
        break;
      case "rect":
        elements.push(
          <Rect
            key={key}
            x={Number(attrs.x)}
            y={Number(attrs.y)}
            width={Number(attrs.width)}
            height={Number(attrs.height)}
            {...common}
          />
        );
        break;
      case "polygon":
        if (attrs.points) elements.push(<Polygon key={key} points={attrs.points} {...common} />);
        break;
    }
  }
  return elements;
}
