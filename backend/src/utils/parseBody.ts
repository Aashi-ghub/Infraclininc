export function parseBody(event: any) {
  try {
    let raw = event.body;
    if (event.isBase64Encoded) {
      raw = Buffer.from(event.body, "base64").toString("utf-8");
    }
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}
