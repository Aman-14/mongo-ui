import { ObjectId } from "bson";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function customStringify(obj: unknown, indent = 0) {
  // Function to generate indentation
  const generateIndent = (level: number) => " ".repeat(level * 4);

  // Recursively stringify the object
  function innerStringify(o: unknown, level: number) {
    if (typeof o === "object" && o !== null) {
      if (o instanceof ObjectId) {
        return 'ObjectId("' + o.toHexString() + '")';
      } else if (o instanceof Date) {
        return 'Date("' + o.toISOString() + '")';
      } else if (Array.isArray(o)) {
        const items: string = o
          .map((item) => innerStringify(item, level + 1))
          .join(",\n" + generateIndent(level + 1));

        return (
          "[\n" +
          generateIndent(level + 1) +
          items +
          "\n" +
          generateIndent(level) +
          "]"
        );
      } else {
        const properties: string = Object.keys(o)
          .map(
            (key) =>
              '"' + key + '": ' + innerStringify((o as any)[key], level + 1),
          )
          .join(",\n" + generateIndent(level + 1));

        return (
          "{\n" +
          generateIndent(level + 1) +
          properties +
          "\n" +
          generateIndent(level) +
          "}"
        );
      }
    } else if (typeof o === "string") {
      return '"' + o + '"';
    } else {
      return String(o);
    }
  }

  return innerStringify(obj, indent);
}
