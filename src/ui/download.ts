/** Save a file. On iPhone the share sheet (Save to Files, AirDrop, Calendar for .ics) is the most reliable route, so try that first. */
export async function saveFile(name: string, text: string, type: string, preferShare = true) {
  const blob = new Blob([text], { type });
  try {
    const file = new File([blob], name, { type });
    if (preferShare && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
