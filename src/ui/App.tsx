import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import CodeBlock from '@tiptap/extension-code-block';
import Image from '@tiptap/extension-image';
import Mathematics from '@tiptap/extension-mathematics';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import FontSize from '../tiptap/FontSize';
import BackgroundColor from '../tiptap/BackgroundColor';
import {
  RiBold,
  RiItalic,
  RiStrikethrough,
  RiUnderline,
  RiMarkPenLine,
  RiParagraph,
  RiH1,
  RiH2,
  RiAlignLeft,
  RiAlignCenter,
  RiAlignRight,
  RiAlignJustify,
  RiListUnordered,
  RiListOrdered,
  RiCodeBoxLine,
  RiImageLine,
  RiMenuLine,
} from 'react-icons/ri';

type Tab = {
  id: string;
  title: string;
  closable: boolean;
  type: 'home' | 'create' | 'doc';
  data?: any;
  filePath?: string | null;
  scrollTop?: number;
};

type DocMeta = {
  title: string;
  description: string;
  goals: string;
  hypotheses: string;
  plan: string;
};

declare global {
  interface Window {
    api: {
      saveDocumentAs: (payload: { defaultPath?: string; jsonData: any; asXml?: boolean }) => Promise<any>;
      saveDocumentToPath: (payload: { filePath: string; jsonData: any; asXml?: boolean }) => Promise<any>;
      openDocument: () => Promise<any>;
      openDocumentPath: (filePath: string) => Promise<any>;
      onOpenFilePath: (cb: (path: string) => void) => void;
      exportPdf: () => Promise<any>;
      newDocument: () => Promise<any>;
      onMenuNew: (cb: () => void) => void;
      onMenuSave: (cb: () => void) => void;
      onMenuSaveAs: (cb: () => void) => void;
      onFileOpened: (cb: (payload: any) => void) => void;
        detachTab: (payload: any) => Promise<any>;
        reattachTab: (payload: any) => Promise<any>;
        onExternalOpenTab: (cb: (payload: any) => void) => void;
        onExternalReattachTab: (cb: (payload: any) => void) => void;
        broadcastCloseToken: (token: string) => Promise<any>;
        startExternalDrag: (payload: any) => void;
        endExternalDrag: () => void;
        onExternalDragStart: (cb: (payload: any) => void) => void;
        onExternalDragEnd: (cb: () => void) => void;
        closeSelf: () => Promise<any>;
        pickImage: () => Promise<{ canceled: boolean; filePath?: string }>;
    };
  }
}

const uid = () => Math.random().toString(36).slice(2);

export const App: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<string>('home');
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'home', title: 'Начало', closable: false, type: 'home' },
  ]);
  const [sidebarView, setSidebarView] = useState<'users' | 'research' | 'recent'>('users');

  const [docMeta, setDocMeta] = useState<DocMeta>({
    title: '',
    description: '',
    goals: '',
    hypotheses: '',
    plan: '',
  });

  const [activeTool, setActiveTool] = useState<'text' | 'tables' | 'formulas' | 'graphs' | null>('text');
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropBefore, setDropBefore] = useState<boolean>(false);
  // detach is triggered by double-click now; DnD used for reorder and reattach only

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId]);

  // Editor must be declared before any useEffect/useRef that references it
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      Color,
      BackgroundColor,
      Underline,
      Highlight,
      FontFamily,
      CodeBlock,
      Image,
      Mathematics,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'a4-canvas',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const active = tabs.find((t) => t.id === activeTabId);
      if (active && active.type === 'doc') {
        const html = ed.getHTML();
        setTabs((prev) => prev.map((t) => t.id === active.id ? { ...t, data: { ...t.data, contentHtml: html } } : t));
      }
    },
  });

  // Force re-render on selection/content changes so toolbar state stays in sync
  const [, setEditorTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const rerender = () => setEditorTick((t) => t + 1);
    editor.on('selectionUpdate', rerender);
    editor.on('transaction', rerender);
    editor.on('update', rerender);
    return () => {
      editor.off('selectionUpdate', rerender);
      editor.off('transaction', rerender);
      editor.off('update', rerender);
    };
  }, [editor]);

  // Refs to avoid duplicate listeners and stale closures
  const activeTabRef = useRef<Tab | undefined>(activeTab);
  const tabsRef = useRef<Tab[]>(tabs);
  const docMetaRef = useRef<DocMeta>({ ...docMeta });
  const editorRef = useRef<any>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const saveAsRef = useRef<() => Promise<void>>(async () => {});
  const viewRef = useRef<HTMLDivElement | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const externalDragPayloadRef = useRef<any>(null);
  function setActiveTabSafely(nextId: string) {
    const currentId = activeTabRef.current?.id;
    const currentScroll = viewRef.current?.scrollTop || 0;
    if (currentId) {
      setTabs((prev) => prev.map((t) => t.id === currentId ? { ...t, scrollTop: currentScroll } : t));
    }
    setActiveTabId(nextId);
    requestAnimationFrame(() => {
      const next = tabsRef.current.find((t) => t.id === nextId);
      if (viewRef.current) viewRef.current.scrollTop = next?.scrollTop || 0;
    });
  }

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { docMetaRef.current = docMeta; }, [docMeta]);
  useEffect(() => { editorRef.current = editor; }, [editor]);
  // Helpers to normalize CSS color strings to #rrggbb for <input type="color">
  function rgbToHex(rgb: string): string | null {
    const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
    if (!m) return null;
    const r = Number(m[1]).toString(16).padStart(2, '0');
    const g = Number(m[2]).toString(16).padStart(2, '0');
    const b = Number(m[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  function normalizeHexColor(value: string | undefined, fallback: string): string {
    if (!value) return fallback;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
    const hex = rgbToHex(value);
    return hex || fallback;
  }



  // Handle OS-level open file (register once)
  useEffect(() => {
    if (!(window as any).api?.onOpenFilePath) return;
    const handler = async (filePath: string) => {
      const res = await window.api.openDocumentPath(filePath);
      if (!res?.canceled) {
        openLoadedDoc(res.data, filePath);
      }
    };
    window.api.onOpenFilePath(handler as any);
  }, []);

  // Listen for menu events (register once; use refs inside). Preload clears previous listeners.
  useEffect(() => {
    if (!(window as any).api) return;
    window.api.onMenuNew(() => openCreateTab());
    window.api.onMenuSave(async () => {
      if (activeTabRef.current?.type === 'doc') await saveRef.current();
    });
    window.api.onMenuSaveAs(async () => {
      if (activeTabRef.current?.type === 'doc') await saveAsRef.current();
    });
    window.api.onFileOpened(({ filePath, data }: any) => openLoadedDoc(data, filePath));
    window.api.onExternalOpenTab((payload: any) => {
      // Child window should not have a Start tab; open only the received tab
      const id = uid();
      const data = payload?.data || {};
      const meta: DocMeta = {
        title: data.title || data?.meta?.title || payload?.title || 'Документ',
        description: data.description || data?.meta?.description || '',
        goals: data.goals || data?.meta?.goals || '',
        hypotheses: data.hypotheses || data?.meta?.hypotheses || '',
        plan: data.plan || data?.meta?.plan || '',
      };
      setTabs([{ id, title: meta.title || 'Документ', closable: true, type: 'doc', data: { meta, contentHtml: data.contentHtml || '<p></p>' }, filePath: payload?.filePath || null }]);
      setActiveTabId(id);
    });
    window.api.onExternalReattachTab((payload: any) => {
      // add back a tab to this window and close child window by token
      const data = payload?.data || {};
      openLoadedDoc(data, payload?.filePath);
      if (payload?.closeToken) {
        window.api.broadcastCloseToken(payload.closeToken);
      }
    });
    // external drag payload listeners
    window.api.onExternalDragStart((payload: any) => { externalDragPayloadRef.current = payload; });
    window.api.onExternalDragEnd(() => { externalDragPayloadRef.current = null; });
  }, []);


  function getCurrentActiveId() {
    return activeTabRef.current?.id ?? activeTabId;
  }

  function openCreateTab() {
    const id = uid();
    setTabs((prev) => {
      const currentId = getCurrentActiveId();
      const insertAfter = prev.findIndex((t) => t.id === currentId);
      const nextTabs = [...prev];
      const newTab: Tab = { id, title: 'Новое исследование', closable: true, type: 'create' };
      const insertIndex = Math.min(Math.max(insertAfter + 1, 0), nextTabs.length);
      nextTabs.splice(insertIndex, 0, newTab);
      return nextTabs;
    });
    setActiveTabSafely(id);
    // reset meta for new doc creation
    setDocMeta({ title: '', description: '', goals: '', hypotheses: '', plan: '' });
    editor?.commands.setContent('<p></p>');
  }

  function createDocument() {
    const id = uid();
    setTabs((prev) => {
      const currentId = getCurrentActiveId();
      const createIndex = prev.findIndex((t) => t.id === currentId);
      const nextTabs = [...prev];
      const newTab: Tab = { id, title: docMeta.title || 'Без названия', closable: true, type: 'doc', data: { meta: { ...docMeta }, contentHtml: '<p></p>' }, filePath: null };
      const insertIndex = Math.min(Math.max(createIndex + 1, 0), nextTabs.length);
      nextTabs.splice(insertIndex, 0, newTab);
      // remove the create tab
      if (createIndex >= 0 && nextTabs[createIndex]?.type === 'create') {
        // If the removal index affects the position of the inserted tab, adjust
        const insertedPos = nextTabs.findIndex((t) => t.id === id);
        nextTabs.splice(createIndex, 1);
        // if removal index was before insertedPos, the inserted tab shifted left by 1. Nothing else to do
      }
      return nextTabs;
    });
    setActiveTabSafely(id);
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id || !t.closable);
      return next;
    });
    if (activeTabId === id) {
      const nextTabs = tabs.filter((t) => t.id !== id || !t.closable);
      const home = nextTabs.find((t) => t.type === 'home');
      setActiveTabId(home ? home.id : (nextTabs[0]?.id || 'home'));
    }
  }

  function openLoadedDoc(data: any, filePath?: string) {
    const id = uid();
    // Do not overwrite global meta/editor when opening new tab; keep per-tab state
    const meta: DocMeta = {
      title: data.title || '',
      description: data.description || '',
      goals: data.goals || '',
      hypotheses: data.hypotheses || '',
      plan: data.plan || '',
    };
    setTabs((prev) => {
      const currentId = getCurrentActiveId();
      const insertAfter = prev.findIndex((t) => t.id === currentId);
      const nextTabs = [...prev];
      const newTab: Tab = { id, title: meta.title || 'Документ', closable: true, type: 'doc', data: { meta, contentHtml: data.contentHtml || '<p></p>' }, filePath: filePath || null };
      const insertIndex = Math.min(Math.max(insertAfter + 1, 0), nextTabs.length);
      nextTabs.splice(insertIndex, 0, newTab);
      return nextTabs;
    });
    setActiveTabSafely(id);
  }

  // Drag and drop reordering of tabs
  function onDragStartTab(e: React.DragEvent<HTMLDivElement>, tabId: string) {
    setDraggingTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    const t = tabs.find(x => x.id === tabId);
    if (t && t.type !== 'home') {
      const html = (t.id === activeTabId ? (editor?.getHTML() || t.data?.contentHtml) : t.data?.contentHtml) || '';
      const payload = { title: t.title, filePath: t.filePath || null, data: { meta: t.data?.meta, contentHtml: html }, closeToken: null };
      window.api.startExternalDrag(payload);
    }
  }

  function onDragOverTab(e: React.DragEvent<HTMLDivElement>, targetTabId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const before = e.clientX < rect.left + rect.width / 2;
    setDropTargetId(targetTabId);
    setDropBefore(before);
  }

  function onDropOnTab(e: React.DragEvent<HTMLDivElement>, targetTabId: string) {
    e.preventDefault();
    const sourceId = draggingTabId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetTabId) {
      setDraggingTabId(null);
      setDropTargetId(null);
      return;
    }
    const sourceIndex = tabs.findIndex((t) => t.id === sourceId);
    const targetIndex = tabs.findIndex((t) => t.id === targetTabId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingTabId(null);
      setDropTargetId(null);
      return;
    }
    // Prevent moving home tab if desired
    if (tabs[sourceIndex].type === 'home') {
      setDraggingTabId(null);
      setDropTargetId(null);
      return;
    }
    // Compute before/after based on cursor
    let insertIndex = targetIndex + (dropBefore ? 0 : 1);
    const newOrder = [...tabs];
    const [moved] = newOrder.splice(sourceIndex, 1);
    // If removing earlier changed target position
    if (sourceIndex < insertIndex) insertIndex -= 1;
    // Keep home tab at index 0
    if (moved.type !== 'home' && insertIndex === 0) insertIndex = 1;
    newOrder.splice(insertIndex, 0, moved);
    setTabs(newOrder);
    setDraggingTabId(null);
    setDropTargetId(null);
  }

  function onDragEndTab(_e?: React.DragEvent) {
    setDraggingTabId(null);
    setDropTargetId(null);
    window.api.endExternalDrag();
  }

  // detach by double-click only

  // No global drag-to-detach. Detach is via double-click.

  async function save(asXml = false) {
    if (activeTab?.type !== 'doc') return;
    const currentTab = tabs.find((t) => t.id === activeTab.id);
    const jsonData = {
      title: docMeta.title,
      description: docMeta.description,
      goals: docMeta.goals,
      hypotheses: docMeta.hypotheses,
      plan: docMeta.plan,
      contentHtml: editor?.getHTML() || '',
      version: 1,
    };
    if (currentTab?.filePath) {
      const res = await window.api.saveDocumentToPath({ filePath: currentTab.filePath, jsonData, asXml: false });
      if (!res?.canceled) {
        setTabs((prev) => prev.map((t) => t.id === currentTab.id ? { ...t, filePath: res.filePath } : t));
      }
    } else {
      await saveAs();
    }
  }

  // expose stable refs for menu handlers
  useEffect(() => {
    saveRef.current = async () => {
      const a = activeTabRef.current;
      if (!a || a.type !== 'doc') return;
      const currentTab = tabsRef.current.find((t) => t.id === a.id);
      const e = editorRef.current;
      const meta = docMetaRef.current;
      const jsonData = {
        title: meta.title,
        description: meta.description,
        goals: meta.goals,
        hypotheses: meta.hypotheses,
        plan: meta.plan,
        contentHtml: e?.getHTML() || '',
        version: 1,
      };
      if (currentTab?.filePath) {
        const res = await window.api.saveDocumentToPath({ filePath: currentTab.filePath, jsonData, asXml: false });
        if (!res?.canceled) {
          setTabs((prev) => prev.map((t) => t.id === currentTab.id ? { ...t, filePath: res.filePath } : t));
        }
      } else {
        await saveAsRef.current();
      }
    };
    saveAsRef.current = async () => {
      const a = activeTabRef.current;
      if (!a || a.type !== 'doc') return;
      const e = editorRef.current;
      const meta = docMetaRef.current;
      const jsonData = {
        title: meta.title,
        description: meta.description,
        goals: meta.goals,
        hypotheses: meta.hypotheses,
        plan: meta.plan,
        contentHtml: e?.getHTML() || '',
        version: 1,
      };
      const res = await window.api.saveDocumentAs({ jsonData, asXml: false });
      if (!res?.canceled) {
        const fp = res.filePath as string;
        setTabs((prev) => prev.map((t) => t.id === a.id ? { ...t, filePath: fp, title: meta.title || t.title } : t));
      }
    };
  }, [tabs, activeTabId, editor, docMeta]);

  async function saveAs() {
    if (activeTab?.type !== 'doc') return;
    const jsonData = {
      title: docMeta.title,
      description: docMeta.description,
      goals: docMeta.goals,
      hypotheses: docMeta.hypotheses,
      plan: docMeta.plan,
      contentHtml: editor?.getHTML() || '',
      version: 1,
    };
    const res = await window.api.saveDocumentAs({ jsonData, asXml: false });
    if (!res?.canceled) {
      const fp = res.filePath as string;
      setTabs((prev) => prev.map((t) => t.id === activeTab.id ? { ...t, filePath: fp, title: docMeta.title || t.title } : t));
    }
  }

  // Sync editor and meta when switching tabs
  useEffect(() => {
    const t = tabs.find((x) => x.id === activeTabId);
    if (!t) return;
    if (t.type === 'doc') {
      const meta = t.data?.meta as DocMeta;
      const html = t.data?.contentHtml as string;
      setDocMeta({ ...meta });
      if (editor && typeof html === 'string') {
        editor.commands.setContent(html || '<p></p>');
      }
    }
  }, [activeTabId]);

  // Update active tab's meta when inputs change
  function updateMeta<K extends keyof DocMeta>(key: K, value: DocMeta[K]) {
    setDocMeta((prev) => ({ ...prev, [key]: value }));
    const t = tabs.find((x) => x.id === activeTabId);
    if (t && t.type === 'doc') {
      setTabs((prev) => prev.map((tab) => tab.id === t.id ? { ...tab, title: key === 'title' ? (value as string) || tab.title : tab.title, data: { ...tab.data, meta: { ...tab.data.meta, [key]: value } } } : tab));
    }
  }

  // openFile handled by menu: 'Open…' sends file:opened

  async function exportPdf() {
    await window.api.exportPdf();
  }

  const hasSidebar = activeTab?.type === 'home';
  return (
    <div className={`app-shell ${hasSidebar ? 'with-sidebar' : 'no-sidebar'}`}>
        <div className="tabs" ref={tabsContainerRef} onWheel={(e) => { const target = e.currentTarget as HTMLDivElement; target.scrollLeft += e.deltaY; }}
          onDragOver={(e) => { e.preventDefault(); }}>
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`tab ${activeTabId === t.id ? 'active' : ''} ${t.type !== 'home' ? 'draggable' : ''} ${draggingTabId === t.id ? 'dragging' : ''} ${dropTargetId === t.id ? (dropBefore ? 'drop-before' : 'drop-after') : ''}`}
              onClick={() => setActiveTabSafely(t.id)}
              onDoubleClick={() => {
                // Detach on double-click
                const realTabs = tabs.filter(x => x.type !== 'home');
                if (t.type === 'home' || realTabs.length <= 1) return;
                const current = tabs.find(x => x.id === t.id);
                const html = (t.id === activeTabId ? (editor?.getHTML() || current?.data?.contentHtml) : current?.data?.contentHtml) || '';
                const meta = (current?.data?.meta as DocMeta) || docMeta;
                const data = { meta, contentHtml: html, title: meta.title };
                window.api.detachTab({ title: t.title, data, filePath: t.filePath || null });
                closeTab(t.id);
              }}
            draggable={t.type !== 'home'}
            onDragStart={(e) => onDragStartTab(e, t.id)}
            onDragOver={(e) => onDragOverTab(e, t.id)}
            onDrop={(e) => onDropOnTab(e, t.id)}
              onDragEnd={(e) => onDragEndTab(e)}
          >
            <span className="title">{t.type === 'home' ? <RiMenuLine /> : t.title}</span>
              {t.closable && (
                <button className="close" aria-label="Close tab" title="Close" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}>
                  ✕
                </button>
              )}
          </div>
        ))}
          {/* Drop attach from external window */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const payload = externalDragPayloadRef.current;
              if (payload) {
                window.api.reattachTab(payload);
                externalDragPayloadRef.current = null;
              }
            }}
            style={{ width: 1, height: 1 }}
          />
      </div>
      {hasSidebar && (
        <div className="sidebar">
          <button onClick={() => setSidebarView('users')}>Пользователи</button>
          <button onClick={() => setSidebarView('research')}>Исследования</button>
          <button onClick={() => setSidebarView('recent')}>Недавнее</button>
        </div>
      )}
      <div className="content">
        <div className="view" ref={viewRef}>
          {activeTab?.type === 'home' && (
            <div>
              <h2>Добро пожаловать в Researcher</h2>
              <p className="section-title">Навигация</p>
              <ul>
                <li>Левая панель: Пользователи, Исследования, Недавнее</li>
                <li>Верхняя панель: создание/сохранение/открытие/экспорт</li>
              </ul>
            </div>
          )}

          {activeTab?.type === 'create' && (
            <div className="doc-form">
              <label>Название</label>
              <input value={docMeta.title} onChange={(e) => updateMeta('title', e.target.value)} />
              <label>Описание</label>
              <textarea rows={3} value={docMeta.description} onChange={(e) => updateMeta('description', e.target.value)} />
              <label>Цели</label>
              <textarea rows={3} value={docMeta.goals} onChange={(e) => updateMeta('goals', e.target.value)} />
              <label>Гипотезы</label>
              <textarea rows={3} value={docMeta.hypotheses} onChange={(e) => updateMeta('hypotheses', e.target.value)} />
              <label>Плановый ход работы</label>
              <textarea rows={3} value={docMeta.plan} onChange={(e) => updateMeta('plan', e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createDocument}>Создать</button>
                <button onClick={() => closeTab(activeTabId)}>Отмена</button>
              </div>
            </div>
          )}

          {activeTab?.type === 'doc' && (
            <div>
              <div className={`sticky-tools ${activeTool ? 'has-active' : 'no-active'}`}>
                {activeTool !== null && (
                <div className="tools-panel">
              {activeTool === 'text' && (
                <div className="toolbar text-toolbar" style={{ flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
                  {/* Font family */}
                  <select
                    className="tool font-select"
                    value={editor?.getAttributes('textStyle').fontFamily || 'system-ui'}
                    onChange={(e) => editor?.chain().focus().setFontFamily((e.target.value || 'system-ui') as string).run()}
                    title="Шрифт"
                  >
                    <option value="system-ui">Системный</option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Verdana">Verdana</option>
                  </select>

                  {/* Font size */}
                  <select
                    className="tool size-select"
                    value={editor?.getAttributes('textStyle').fontSize || '16px'}
                    onChange={(e) => {
                      const v = e.target.value;
                      editor?.chain().focus().setMark('textStyle', { fontSize: v }).run();
                    }}
                    title="Размер шрифта"
                  >
                    <option value="12px">12</option>
                    <option value="14px">14</option>
                    <option value="16px">16</option>
                    <option value="18px">18</option>
                    <option value="24px">24</option>
                    <option value="32px">32</option>
                    <option value="48px">48</option>
                  </select>

                  {/* Colors */}
                  <input
                    className="tool color-swatch text-color"
                    aria-label="Цвет текста"
                    title="Цвет текста"
                    type="color"
                    value={normalizeHexColor(editor?.getAttributes('textStyle').color, '#000000')}
                    onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
                  />
                  <input
                    className="tool color-swatch bg-color"
                    aria-label="Цвет фона текста"
                    title="Цвет фона текста"
                    type="color"
                    value={normalizeHexColor(editor?.getAttributes('textStyle').backgroundColor, '#ffffff')}
                    onChange={(e) => editor?.chain().focus().setBackgroundColor(e.target.value).run()}
                  />

                  {/* Alignment buttons */}
                  <button className={`tool ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().setTextAlign('left').run()} title="По левому"><RiAlignLeft /></button>
                  <button className={`tool ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().setTextAlign('center').run()} title="По центру"><RiAlignCenter /></button>
                  <button className={`tool ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().setTextAlign('right').run()} title="По правому"><RiAlignRight /></button>
                  <button className={`tool ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} title="По ширине"><RiAlignJustify /></button>

                  {/* Styles */}
                  <button className={`tool ${editor?.isActive('bold') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleBold().run()} title="Полужирный"><RiBold /></button>
                  <button className={`tool ${editor?.isActive('italic') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Курсив"><RiItalic /></button>
                  <button className={`tool ${editor?.isActive('strike') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleStrike().run()} title="Зачёркнутый"><RiStrikethrough /></button>
                  <button className={`tool ${editor?.isActive('underline') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Подчёркнутый"><RiUnderline /></button>
                  <button className={`tool ${editor?.isActive('highlight') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleHighlight().run()} title="Подсветка"><RiMarkPenLine /></button>

                  {/* Paragraph/Headings buttons */}
                  <button className={`tool ${editor?.isActive('paragraph') ? 'active' : ''}`} onClick={() => editor?.chain().focus().setParagraph().run()} title="Параграф"><RiParagraph /></button>
                  <button className={`tool ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().setHeading({ level: 1 }).run()} title="Заголовок 1"><RiH1 /></button>
                  <button className={`tool ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().setHeading({ level: 2 }).run()} title="Заголовок 2"><RiH2 /></button>

                  {/* Lists */}
                  <button className={`tool ${editor?.isActive('bulletList') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Маркированный список"><RiListUnordered /></button>
                  <button className={`tool ${editor?.isActive('orderedList') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Нумерованный список"><RiListOrdered /></button>

                  {/* Code block and image */}
                  <button className="tool" title="Блок кода" onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><RiCodeBoxLine /></button>
                  <button className="tool" title="Вставить изображение" onClick={async () => { const r = await window.api.pickImage(); if (!r?.canceled && (r as any).dataUrl) editor?.chain().focus().setImage({ src: (r as any).dataUrl }).run(); }}><RiImageLine /></button>
                </div>
              )}

              {activeTool === 'tables' && (
                <div className="toolbar" style={{ justifyContent: 'center' }}>
                  <button onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Вставить таблицу</button>
                  <button onClick={() => editor?.chain().focus().addColumnBefore().run()}>Колонка слева</button>
                  <button onClick={() => editor?.chain().focus().addColumnAfter().run()}>Колонка справа</button>
                  <button onClick={() => editor?.chain().focus().addRowBefore().run()}>Строка выше</button>
                  <button onClick={() => editor?.chain().focus().addRowAfter().run()}>Строка ниже</button>
                  <button onClick={() => editor?.chain().focus().deleteColumn().run()}>Удалить колонку</button>
                  <button onClick={() => editor?.chain().focus().deleteRow().run()}>Удалить строку</button>
                  <button onClick={() => editor?.chain().focus().deleteTable().run()}>Удалить таблицу</button>
                </div>
              )}

              {activeTool === 'formulas' && (
                <div className="toolbar" style={{ justifyContent: 'center' }}>
                  <FormulaBar editor={editor} />
                </div>
              )}

              {activeTool === 'graphs' && (
                <div className="toolbar" style={{ justifyContent: 'center' }}>
                  <GraphsBar editor={editor} />
                </div>
              )}
                </div>
                )}
                <div className="tool-tabs">
                  <button className={`tool-tab ${activeTool === 'text' ? 'active' : ''}`} onClick={() => setActiveTool(prev => prev === 'text' ? null : 'text')}>Text</button>
                  <button className={`tool-tab ${activeTool === 'tables' ? 'active' : ''}`} onClick={() => setActiveTool(prev => prev === 'tables' ? null : 'tables')}>Tables</button>
                  <button className={`tool-tab ${activeTool === 'formulas' ? 'active' : ''}`} onClick={() => setActiveTool(prev => prev === 'formulas' ? null : 'formulas')}>Formulas</button>
                  <button className={`tool-tab ${activeTool === 'graphs' ? 'active' : ''}`} onClick={() => setActiveTool(prev => prev === 'graphs' ? null : 'graphs')}>Graphs</button>
                </div>
              </div>

              <EditorContent editor={editor} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FormulaBar: React.FC<{ editor: any }> = ({ editor }) => {
  const [latex, setLatex] = useState('E = mc^2');
  function insertFormula() {
    const html = `<span class="formula">$${latex}$</span>`;
    editor?.commands.insertContent(html);
  }
  return (
    <>
      <input value={latex} onChange={(e) => setLatex(e.target.value)} placeholder="TeX формула" />
      <button onClick={insertFormula}>Вставить формулу</button>
      <span className="muted">(рендер в PDF через браузерный движок; для точного KaTeX-рендера можно расширить позже)</span>
    </>
  );
};

const GraphsBar: React.FC<{ editor: any }> = ({ editor }) => {
  const defaultData = [
    { name: 'A', value: 12 },
    { name: 'B', value: 30 },
    { name: 'C', value: 18 },
  ];
  function insertGraph() {
    const payload = encodeURIComponent(JSON.stringify(defaultData));
    const html = `<div class="graph" data-chart="bar" data-payload="${payload}">[Graph]</div>`;
    editor?.commands.insertContent(html);
  }
  return (
    <>
      <button onClick={insertGraph}>Вставить график (bar)</button>
      <span className="muted">(визуализация в редакторе упростнена; можно сделать виджет с Recharts)</span>
    </>
  );
};


