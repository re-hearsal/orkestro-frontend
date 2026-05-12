function looksLikeSvg(markup: string): boolean {
  const normalized = markup.trimStart().toLowerCase();
  return normalized.startsWith("<svg") || normalized.startsWith("<?xml") || normalized.includes("<svg");
}

export async function toRenderableImageSource(blob: Blob): Promise<string> {
  if (blob.type.includes("svg")) {
    const svgText = await blob.text();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgText)}`;
  }

  if (blob.type.startsWith("image/")) {
    return URL.createObjectURL(blob);
  }

  if (blob.type === "" || blob.type.includes("octet-stream") || blob.type.includes("xml") || blob.type.includes("text")) {
    const probe = await blob.slice(0, 2048).text();
    if (looksLikeSvg(probe)) {
      const svgText = await blob.text();
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgText)}`;
    }
  }

  return URL.createObjectURL(blob);
}

export function isBlobUrl(src: string): boolean {
  return src.startsWith("blob:");
}
