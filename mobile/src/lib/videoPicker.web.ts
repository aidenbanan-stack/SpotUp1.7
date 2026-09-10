import type { ImagePickerAsset } from "expo-image-picker";
export function pickBrowserVideo(
  camera: boolean,
): Promise<ImagePickerAsset | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";
    if (camera) input.setAttribute("capture", "environment");
    input.oncancel = () => resolve(null);
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const mime =
        file.type ||
        (/\.webm$/i.test(file.name)
          ? "video/webm"
          : /\.mov$/i.test(file.name)
            ? "video/quicktime"
            : "video/mp4");
      if (!["video/mp4", "video/quicktime", "video/webm"].includes(mime)) {
        reject(Error("Choose an MP4, MOV, or WebM video."));
        return;
      }
      if (file.size > 104857600) {
        reject(Error("Choose a video under 100 MB."));
        return;
      }
      const uri = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      const timer = setTimeout(() => {
        URL.revokeObjectURL(uri);
        reject(
          Error(
            "Could not read this video. Try an MP4 exported from your device.",
          ),
        );
      }, 15000);
      video.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(uri);
        reject(
          Error(
            "Your browser cannot read this video. Try an MP4 (H.264) export.",
          ),
        );
      };
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          URL.revokeObjectURL(uri);
          reject(
            Error(
              "Could not determine video length. Export the clip as MP4 and try again.",
            ),
          );
          return;
        }
        resolve({
          uri,
          width: video.videoWidth,
          height: video.videoHeight,
          type: "video",
          file,
          fileSize: file.size,
          fileName: file.name,
          mimeType: mime,
          duration: video.duration * 1000,
        });
      };
      video.src = uri;
    };
    input.click();
  });
}
