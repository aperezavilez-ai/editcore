import * as vscode from "vscode";

export interface ChatTextPart {
  type: "text";
  text: string;
}

export interface ChatImagePart {
  type: "image";
  mimeType: string;
  data: Uint8Array;
}

export type ChatContentPart = ChatTextPart | ChatImagePart;

export type ChatMessageContent = string | ChatContentPart[];

export interface ResolvedImage {
  mimeType: string;
  data: Uint8Array;
  name?: string;
}

interface ChatReferenceBinaryDataLike {
  mimeType: string;
  data: () => Thenable<Uint8Array>;
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i;

export function isMultimodalContent(content: ChatMessageContent): content is ChatContentPart[] {
  return Array.isArray(content);
}

export function contentToPlainText(content: ChatMessageContent): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((part): part is ChatTextPart => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function messageHasText(content: ChatMessageContent): boolean {
  return contentToPlainText(content).length > 0;
}

export function buildUserContent(text: string, images: ResolvedImage[]): ChatMessageContent {
  const trimmed = text.trim();
  if (images.length === 0) {
    return trimmed;
  }

  const parts: ChatContentPart[] = [];
  if (trimmed) {
    parts.push({ type: "text", text: trimmed });
  } else {
    parts.push({
      type: "text",
      text: "Analiza la imagen adjunta y responde en español.",
    });
  }

  for (const image of images) {
    parts.push({
      type: "image",
      mimeType: normalizeImageMime(image.mimeType),
      data: image.data,
    });
  }

  return parts;
}

export async function resolveImagesFromReferences(
  references: readonly vscode.ChatPromptReference[]
): Promise<ResolvedImage[]> {
  const images: ResolvedImage[] = [];
  for (const ref of references) {
    const image = await resolveImageFromReference(ref);
    if (image) {
      images.push(image);
    }
  }
  return images;
}

async function resolveImageFromReference(
  ref: vscode.ChatPromptReference
): Promise<ResolvedImage | undefined> {
  const value = ref.value as unknown;

  if (isChatReferenceBinaryData(value)) {
    const raw = await value.data();
    if (!raw?.length) {
      return undefined;
    }
    return {
      mimeType: normalizeImageMime(value.mimeType),
      data: raw instanceof Uint8Array ? raw : new Uint8Array(raw),
      name: ref.id,
    };
  }

  if (value instanceof vscode.Uri && isImagePath(value.fsPath)) {
    try {
      const bytes = await vscode.workspace.fs.readFile(value);
      return {
        mimeType: mimeFromPath(value.fsPath),
        data: bytes,
        name: ref.id || value.fsPath.split(/[/\\]/).pop(),
      };
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function extractImagesFromLanguageModelParts(
  parts: ReadonlyArray<unknown>
): { text: string; images: ResolvedImage[] } {
  const images: ResolvedImage[] = [];
  const textParts: string[] = [];

  for (const part of parts) {
    if (typeof part === "string") {
      textParts.push(part);
      continue;
    }
    if (part instanceof vscode.LanguageModelTextPart) {
      textParts.push(part.value);
      continue;
    }
    if (part instanceof vscode.LanguageModelDataPart && isImageMime(part.mimeType)) {
      images.push({
        mimeType: normalizeImageMime(part.mimeType),
        data: part.data,
      });
      continue;
    }
    if (part && typeof part === "object" && "value" in part) {
      const value = (part as { value?: unknown }).value;
      if (typeof value === "string") {
        textParts.push(value);
      }
    }
  }

  return {
    text: textParts.join("").trim(),
    images,
  };
}

function isChatReferenceBinaryData(value: unknown): value is ChatReferenceBinaryDataLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "mimeType" in value &&
    "data" in value &&
    typeof (value as ChatReferenceBinaryDataLike).data === "function"
  );
}

function isImagePath(path: string): boolean {
  return IMAGE_EXTENSIONS.test(path);
}

function isImageMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  return "image/png";
}

function normalizeImageMime(mimeType: string): string {
  const mime = mimeType.toLowerCase();
  if (mime === "image/jpg") {
    return "image/jpeg";
  }
  if (isImageMime(mime)) {
    return mime;
  }
  return "image/png";
}

export type AnthropicImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export function toAnthropicImageMediaType(mimeType: string): AnthropicImageMediaType {
  const mime = normalizeImageMime(mimeType);
  if (mime === "image/jpeg" || mime === "image/gif" || mime === "image/webp") {
    return mime;
  }
  return "image/png";
}

export function toAnthropicMessageContent(
  content: ChatMessageContent
): string | Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: AnthropicImageMediaType; data: string } }> {
  if (typeof content === "string") {
    return content;
  }

  return content.map((part) => {
    if (part.type === "text") {
      return { type: "text" as const, text: part.text };
    }
    return {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: toAnthropicImageMediaType(part.mimeType),
        data: Buffer.from(part.data).toString("base64"),
      },
    };
  });
}

export function toOpenAiMessageContent(
  content: ChatMessageContent
): string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  if (typeof content === "string") {
    return content;
  }

  return content.map((part) => {
    if (part.type === "text") {
      return { type: "text" as const, text: part.text };
    }
    const base64 = Buffer.from(part.data).toString("base64");
    return {
      type: "image_url" as const,
      image_url: {
        url: `data:${part.mimeType};base64,${base64}`,
      },
    };
  });
}
