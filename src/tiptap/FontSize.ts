import { Extension, CommandProps } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

// Adds a fontSize attribute to the existing textStyle mark and provides
// convenient setFontSize / unsetFontSize commands.
const FontSize = Extension.create({
  name: 'fontSize',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null as string | null,
            parseHTML: (element: HTMLElement) => {
              const size = element.style.fontSize;
              return size ? size : null;
            },
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) => ({ chain }: CommandProps) => {
          return chain().setMark('textStyle', { fontSize: size }).run();
        },
      unsetFontSize:
        () => ({ chain }: CommandProps) => {
          // Clear the attribute
          return chain().setMark('textStyle', { fontSize: null }).run();
        },
    } as any;
  },
});

export default FontSize;


