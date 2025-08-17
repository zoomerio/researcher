import { Extension } from '@tiptap/core';
import { Plugin } from 'prosemirror-state';

type DragState = {
  active: boolean;
  startClientY: number;
  rowDepth: number;
  rowPos: number;
  initialHeight: number;
};

// Adds direct row height resizing by dragging near the bottom edge of a cell
const RowResize = Extension.create({
  name: 'rowResize',
  addProseMirrorPlugins() {
    const drag: DragState = {
      active: false,
      startClientY: 0,
      rowDepth: -1,
      rowPos: -1,
      initialHeight: 0,
    };

    const minHit = 6; // px threshold near bottom edge (wider for easier grab)

    const setRowMinHeight = (view: any, rowPos: number, minHeightPx: number) => {
      const { state, dispatch } = view;
      const tr = state.tr;
      const row = state.doc.nodeAt(rowPos);
      if (!row) return;
      row.forEach((cell: any, offset: number) => {
        const pos = rowPos + 1 + offset;
        const attrs = { ...cell.attrs, style: (() => {
          const style = (cell.attrs?.style || '') as string;
          const filtered = style.split(';').map(s => s.trim()).filter(Boolean).filter(s => !s.startsWith('min-height:') && !s.startsWith('height:'));
          return `${filtered.join(';')}${filtered.length ? ';' : ''}min-height:${Math.max(0, Math.round(minHeightPx))}px`;
        })() };
        tr.setNodeMarkup(pos, undefined, attrs);
      });
      dispatch(tr);
    };

    const clearDrag = (view: any) => {
      drag.active = false;
      drag.rowDepth = -1;
      drag.rowPos = -1;
      drag.initialHeight = 0;
      if (view && view.dom) (view.dom as HTMLElement).classList.remove('row-resize-active');
      document.body.style.cursor = '';
    };

    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              const e = event as MouseEvent;
              const target = e.target as HTMLElement;
              // Only consider cells
              const cell = target.closest('td, th') as HTMLElement | null;
              if (!cell) return false;
              const rect = cell.getBoundingClientRect();
              const hit = rect.bottom - e.clientY;
              if (hit >= 0 && hit <= minHit) {
                // Find row
                const pos = view.posAtCoords({ left: e.clientX, top: e.clientY });
                if (!pos) return false;
                const $pos: any = view.state.doc.resolve(pos.pos);
                let rowDepth = -1;
                for (let d = $pos.depth; d > 0; d--) {
                  if ($pos.node(d).type.name === 'tableRow') { rowDepth = d; break; }
                }
                if (rowDepth === -1) return false;
                const rowPos = $pos.before(rowDepth);
                drag.active = true;
                drag.startClientY = e.clientY;
                drag.rowDepth = rowDepth;
                drag.rowPos = rowPos;
                drag.initialHeight = rect.height;
                (view.dom as HTMLElement).classList.add('row-resize-active');
                document.body.style.cursor = 'row-resize';
                e.preventDefault();
                return true;
              }
              return false;
            },
            mousemove: (view, event) => {
              if (!drag.active) return false;
              const e = event as MouseEvent;
              const delta = e.clientY - drag.startClientY;
              const nextHeight = Math.max(16, drag.initialHeight + delta);
              setRowMinHeight(view, drag.rowPos, nextHeight);
              e.preventDefault();
              return true;
            },
            mouseup: (view, event) => {
              if (!drag.active) return false;
              clearDrag(view);
              (event as MouseEvent).preventDefault();
              return true;
            },
          },
        },
        view: (view) => {
          const onLeave = () => { if (drag.active) clearDrag(view); };
          window.addEventListener('blur', onLeave);
          window.addEventListener('mouseup', onLeave);
          return {
            destroy() {
              window.removeEventListener('blur', onLeave);
              window.removeEventListener('mouseup', onLeave);
            },
          } as any;
        },
      }),
    ];
  },
});

export default RowResize;


