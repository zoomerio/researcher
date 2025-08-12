import { Extension, CommandProps } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    backgroundColor: {
      setBackgroundColor: (color: string) => ReturnType;
      unsetBackgroundColor: () => ReturnType;
    };
  }
}

const BackgroundColor = Extension.create({
  name: 'backgroundColor',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          backgroundColor: {
            default: null as string | null,
            parseHTML: (element: HTMLElement) => {
              const v = element.style.backgroundColor;
              return v ? v : null;
            },
            renderHTML: (attributes: { backgroundColor?: string | null }) => {
              if (!attributes.backgroundColor) return {};
              return { style: `background-color: ${attributes.backgroundColor}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBackgroundColor:
        (color: string) => ({ chain }: CommandProps) => {
          return chain().setMark('textStyle', { backgroundColor: color }).run();
        },
      unsetBackgroundColor:
        () => ({ chain }: CommandProps) => {
          return chain().setMark('textStyle', { backgroundColor: null }).run();
        },
    } as any;
  },
});

export default BackgroundColor;


