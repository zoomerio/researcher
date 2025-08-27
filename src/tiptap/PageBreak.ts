import { Node, mergeAttributes, CommandProps } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

export interface PageBreakOptions {
  HTMLAttributes: Record<string, any>;
}

const PageBreak = Node.create<PageBreakOptions>({
  name: 'pageBreak',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  parseHTML() {
    return [
      {
        tag: 'div[data-type="page-break"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'page-break',
          class: 'page-break',
        },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      [
        'div',
        { class: 'page-break-line' },
      ],
      // Remove the text label - just the visual line
      '',
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    };
  },
});

export default PageBreak;
