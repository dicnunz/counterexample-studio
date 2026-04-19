import path from "node:path";

export function toDisplayPath(filePath: string, cwd = process.cwd()): string {
  const normalizedPath = path.normalize(filePath);
  const displayPath = path.isAbsolute(normalizedPath)
    ? path.relative(cwd, normalizedPath) || "."
    : normalizedPath;

  if (displayPath === ".") {
    return "./";
  }

  if (displayPath.startsWith(".") || displayPath.startsWith(path.sep)) {
    return displayPath;
  }

  return `.${path.sep}${displayPath}`;
}
