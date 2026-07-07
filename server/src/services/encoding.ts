/**
 * 编码工具：处理 Multer/busboy 产生的 latin1 mojibake 文件名。
 *
 * Multer 底层的 busboy 默认按 latin1 读取 multipart 表单中的文件名，
 * 而浏览器发送的是 UTF-8 编码的文件名。这导致中文文件名被错误地
 * 读成 mojibake（如 "微信图片" → "å¾®ä¿¡å¾ç"）。
 */

/**
 * 检测字符串是否为 mojibake（UTF-8 字节被误读为 latin1）。
 * 判据：字符串含 latin1 补充区字符（U+0080-U+00FF），
 * 且将其按 latin1 重新编码为字节后解码为 UTF-8 能产生中文字符。
 */
export function isMojibake(s: string): boolean {
  if (!s || !/[\u0080-\u00ff]/.test(s)) return false;
  try {
    const decoded = Buffer.from(s, 'latin1').toString('utf8');
    return decoded !== s && /[\u4e00-\u9fa5]/.test(decoded);
  } catch {
    return false;
  }
}

/**
 * 安全解码文件名：仅当输入是 mojibake 时才解码，否则原样返回。
 * 这避免了将已经是正确 UTF-8 的字符串二次解码导致损坏。
 */
export function decodeFileName(filename: string): string {
  if (!isMojibake(filename)) return filename;
  try {
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch {
    return filename;
  }
}
