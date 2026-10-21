/**
 * Client-Side Image Resizing, Compression, and SHA-256 Hashing
 * Enforces max 1024px on long side, ~0.8 JPEG quality to drastically cut Vision API latency
 */

export interface ProcessedImage {
  file: File;
  previewUrl: string;
  base64Data: string;
  sha256: string;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
}

export async function resizeAndCompressImage(
  file: File,
  maxDimension = 1024,
  quality = 0.8
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    // If not an image, reject early
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not a supported image format."));
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Unable to initialize canvas 2D rendering context."));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      const cleanBase64 = compressedDataUrl.replace(/^data:[^;]+;base64,/, "");

      // Compute SHA-256 hash via Web Crypto API in browser
      let sha256 = "";
      try {
        const binaryString = atob(cleanBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        sha256 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch {
        sha256 = `fallback-${Date.now()}`;
      }

      // Convert canvas to Blob & File
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas compression failed to generate binary blob."));
            return;
          }

          const resizedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg", lastModified: Date.now() }
          );

          resolve({
            file: resizedFile,
            previewUrl: compressedDataUrl,
            base64Data: cleanBase64,
            sha256,
            width,
            height,
            originalBytes: file.size,
            compressedBytes: blob.size,
          });
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load and decode image data."));
    };

    img.src = objectUrl;
  });
}
