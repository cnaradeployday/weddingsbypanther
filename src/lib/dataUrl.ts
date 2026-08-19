// Converts a data: URL (e.g. from a canvas render or an <input type="file">
// read) into a Blob suitable for uploading to Supabase storage. Shared
// between anywhere that persists a generated preview image — the main
// product configurator and the related-products quick-add — so both write
// identical files to the same "personalization-renders" bucket.
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
