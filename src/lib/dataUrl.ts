// Converts a data: URL (e.g. from a canvas render or an <input type="file">
// read) into a Blob suitable for uploading to Supabase storage. Shared
// between anywhere that persists a generated preview image — the main
// product configurator and the related-products quick-add — so both write
// identical files to the same "personalization-renders" bucket.
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

// The other direction — reads a File (e.g. from an <input type="file">) as
// a data: URL, for the live preview and for handing off to another product
// page (sessionStorage can't hold a File object itself).
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
