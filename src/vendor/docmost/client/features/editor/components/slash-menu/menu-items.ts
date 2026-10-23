import { IconBlockquote, IconCheckbox, IconCode, IconH1, IconH2, IconH3, IconInfoCircle, IconList, IconListNumbers, IconTable, IconTypography, IconMenu4, IconPageBreak } from "@tabler/icons-react";
import type { CommandProps, SlashMenuGroupedItemsType } from "./types";
import { docmostI18n as i18n } from "@knowledge/docmost/i18n";

const CommandGroups: SlashMenuGroupedItemsType = { basic: [
    {
      title: "Text",
      description: "Just start typing with plain text.",
      searchTerms: ["p", "paragraph"],
      icon: IconTypography,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode("paragraph", "paragraph")
          .run();
      },
    },
    {
      title: "To-do list",
      description: "Track tasks with a to-do list.",
      searchTerms: ["todo", "task", "list", "check", "checkbox"],
      icon: IconCheckbox,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "Heading 1",
      description: "Big section heading.",
      searchTerms: ["title", "big", "large"],
      icon: IconH1,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run();
      },
    },
    {
      title: "Heading 2",
      description: "Medium section heading.",
      searchTerms: ["subtitle", "medium"],
      icon: IconH2,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run();
      },
    },
    {
      title: "Heading 3",
      description: "Small section heading.",
      searchTerms: ["subtitle", "small"],
      icon: IconH3,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run();
      },
    },
    {
      title: "Bullet list",
      description: "Create a simple bullet list.",
      searchTerms: ["unordered", "point", "list"],
      icon: IconList,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "Numbered list",
      description: "Create a list with numbering.",
      searchTerms: ["numbered", "ordered", "list", "ol"],
      icon: IconListNumbers,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "Quote",
      description: "Create block quote.",
      searchTerms: ["blockquote", "quotes"],
      icon: IconBlockquote,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      title: "Code",
      description: "Insert code snippet.",
      searchTerms: ["codeblock"],
      icon: IconCode,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      title: "Divider",
      description: "Insert horizontal rule divider",
      searchTerms: ["horizontal rule", "hr"],
      icon: IconMenu4,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      title: "Page break",
      description: "Insert a page break for printing.",
      searchTerms: ["page", "break", "pagebreak", "print"],
      icon: IconPageBreak,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setPageBreak().run(),
    },
    {
      title: "Table",
      description: "Insert a table.",
      searchTerms: ["table", "rows", "columns"],
      icon: IconTable,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      title: "Callout",
      description: "Insert callout notice.",
      searchTerms: [
        "callout",
        "notice",
        "panel",
        "info",
        "warning",
        "success",
        "error",
        "danger",
      ],
      icon: IconInfoCircle,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleCallout().run(),
    },
] };

export const getSuggestionItems = ({
  query,
  excludeItems,
}: {
  query: string;
  excludeItems?: Set<string>;
}): SlashMenuGroupedItemsType => {
  const search = query.toLowerCase();
  const filteredGroups: SlashMenuGroupedItemsType = {};

  const fuzzyMatch = (query: string, target: string) => {
    let queryIndex = 0;
    target = target.toLowerCase();
    for (const char of target) {
      if (query[queryIndex] === char) queryIndex++;
      if (queryIndex === query.length) return true;
    }
    return false;
  };

  for (const [group, items] of Object.entries(CommandGroups)) {
    const filteredItems = items.filter((item) => {
      if (excludeItems?.has(item.title)) return false;
      const translatedTitle = i18n.t(item.title);
      const translatedDescription = i18n.t(item.description);
      return (
        fuzzyMatch(search, item.title) ||
        fuzzyMatch(search, translatedTitle) ||
        item.description.toLowerCase().includes(search) ||
        translatedDescription.toLowerCase().includes(search) ||
        (item.searchTerms &&
          item.searchTerms.some(
            (term: string) =>
              term.includes(search) ||
              i18n.t(term).toLowerCase().includes(search),
          ))
      );
    });

    if (filteredItems.length) {
      filteredGroups[group] = filteredItems.sort((a, b) => {
        const aTitle =
          a.title.toLowerCase().includes(search) ||
          i18n.t(a.title).toLowerCase().includes(search)
            ? 0
            : 1;
        const bTitle =
          b.title.toLowerCase().includes(search) ||
          i18n.t(b.title).toLowerCase().includes(search)
            ? 0
            : 1;
        return aTitle - bTitle;
      });
    }
  }

  return filteredGroups;
};

export default getSuggestionItems;
