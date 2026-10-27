// Редактор кода на CodeMirror 6. Подсветка по токенам темы, Ctrl/Cmd+Enter — запуск.
import { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, placeholder as ph } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit, StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';
import { go } from '@codemirror/legacy-modes/mode/go';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';

const style = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--hl-kw, #b5468b)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--hl-str, #2c8a4b)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--hl-num, #b5650b)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--muted)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--hl-fn, #2f6fd6)' },
  { tag: [t.typeName, t.className, t.standard(t.typeName)], color: 'var(--hl-type, #0f8c95)' },
  { tag: [t.propertyName], color: 'var(--hl-prop, #7a4bc9)' },
  { tag: [t.operator, t.punctuation], color: 'var(--text-2)' },
]);

const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--text)' },
  '.cm-content': { caretColor: 'var(--accent-strong)', padding: '10px 0' },
  '.cm-cursor': { borderLeftColor: 'var(--accent-strong)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(243,179,61,.28) !important' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(243,179,61,.25)', outline: 'none' },
  '.cm-placeholder': { color: 'var(--muted)' },
});

function langExt(lang: string) {
  switch (lang) {
    case 'go':
      return [StreamLanguage.define(go), indentUnit.of('\t')];
    case 'sql':
      return sql({ dialect: PostgreSQL, upperCaseKeywords: true });
    case 'js':
      return javascript();
    case 'python':
      return [python(), indentUnit.of('    ')];
    default:
      return [];
  }
}

export interface CodeEditorProps {
  value: string;
  lang: string;
  onChange?: (v: string) => void;
  onRun?: () => void;
  readOnly?: boolean;
  minLines?: number;
  placeholder?: string;
}

export function CodeEditor({ value, lang, onChange, onRun, readOnly, minLines = 4, placeholder }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cbs = useRef({ onChange, onRun });
  cbs.current = { onChange, onRun };
  const ro = useRef(new Compartment());

  useEffect(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        EditorState.tabSize.of(4),
        keymap.of([
          { key: 'Mod-Enter', run: () => (cbs.current.onRun?.(), true) },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        langExt(lang),
        syntaxHighlighting(style),
        theme,
        ph(placeholder ?? ''),
        ro.current.of([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) cbs.current.onChange?.(u.state.doc.toString());
        }),
        EditorView.contentAttributes.of({ 'aria-label': `Редактор кода (${lang})`, spellcheck: 'false' }),
        EditorView.theme({ '.cm-content, .cm-gutter': { minHeight: `${minLines * 1.6 * 14.5 + 20}px` } }),
      ],
    });
    const v = new EditorView({ state, parent: host.current! });
    view.current = v;
    return () => v.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // внешнее обновление значения (сброс к стартовому коду, показ решения)
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: ro.current.reconfigure([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]) });
  }, [readOnly]);

  return <div className="editor" ref={host} />;
}
