import type { ImagePickerAsset } from "expo-image-picker";
export async function pickBrowserVideo(
  _camera: boolean,
): Promise<ImagePickerAsset | null> {
  throw Error("Use the device video picker.");
}
