import { Gdk } from "ags/gtk4";

export const cursorPointer = Gdk.Cursor.new_from_name("pointer", null)

export function stringLimit(limit: number) {
  return (title?: string | null) => {
    if (!title)
      return "";

    if (title.length > limit) {
      title = title.substring(0, limit - 3) + "...";
    }
    return title;
  }
}

