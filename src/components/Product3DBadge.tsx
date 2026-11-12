// "agregale un simbolo a los productos que tengan cargado el glb, para que
// sepan los clientes que pueden hacer un render 3d" — a small corner badge
// shown wherever a product's photo is browsed (catalog grid, related-rail
// cards, the product landing hero), independent of the "Ver en 3D" button
// that actually opens the viewer inside the builder.
export function Product3DBadge({ className = "absolute top-3 right-3" }: { className?: string }) {
  return (
    <span
      className={`${className} z-10 flex h-7 w-7 items-center justify-center rounded-full bg-dark/80 text-cream-light backdrop-blur-sm`}
      title="3D view available"
      aria-label="3D view available"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
        <path d="M4 7.5 12 12l8-4.5" />
        <path d="M12 12v9" />
      </svg>
    </span>
  );
}
