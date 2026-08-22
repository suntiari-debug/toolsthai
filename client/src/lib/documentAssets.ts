export const MAX_DOCUMENT_ASSET_BYTES = 500_000;
const ALLOWED_DOCUMENT_ASSET_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function validateDocumentAssetFile(file: Pick<File, "type" | "size"> | undefined, label: string) {
  if (!file) return { valid: false as const, message: "กรุณาเลือกไฟล์ภาพ" };
  if (!ALLOWED_DOCUMENT_ASSET_TYPES.has(file.type)) return { valid: false as const, message: `${label}รองรับเฉพาะ PNG, JPG และ WEBP` };
  if (file.size > MAX_DOCUMENT_ASSET_BYTES) return { valid: false as const, message: `ไฟล์${label}ต้องมีขนาดไม่เกิน 500 KB` };
  return { valid: true as const };
}

export function readDocumentAssetAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ภาพได้"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}
