// Склейка Go-исходников: код ученика + харнесс → один файл package main.
// yaegi не умеет повторно импортировать пакет во втором Eval, поэтому объединяем импорты сами.

interface GoFile {
  imports: string[]; // строки вида `"fmt"` или `str "strings"`
  body: string;
}

function splitGo(src: string): GoFile {
  let s = src.replace(/^﻿/, '');
  // убираем package-клаузу
  s = s.replace(/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*package\s+\w+\s*;?/, '');
  const imports: string[] = [];
  // import ( ... ) и import "x" подряд в начале файла
  for (;;) {
    const m = s.match(/^(\s|\/\/[^\n]*\n)*import\s*(\(([\s\S]*?)\)|((?:[\w.]+\s+)?"[^"]+"))\s*;?/);
    if (!m) break;
    if (m[3] !== undefined) {
      for (const line of m[3].split(/[\n;]/)) {
        const t = line.replace(/\/\/.*$/, '').trim();
        if (t) imports.push(t);
      }
    } else imports.push(m[4].trim());
    s = s.slice(m[0].length);
  }
  return { imports, body: s };
}

/**
 * Убирает верхнеуровневую func main() из кода ученика, заменяя её пустыми строками (номера строк не сдвигаются).
 * Нужна, когда своя main есть у харнесса: этап лабы проверяется внутри целой программы, где main уже написана.
 */
export function dropGoMain(src: string): string {
  const m = /^func\s+main\s*\(\s*\)\s*\{/m.exec(src);
  if (!m) return src;
  let depth = 0;
  let i = m.index + m[0].length - 1;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') i = src.indexOf('\n', i) < 0 ? src.length : src.indexOf('\n', i) - 1;
    else if (ch === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2);
      if (i >= 0) i++;
    }
    else if (ch === '"' || ch === "'") {
      for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i++;
    } else if (ch === '`') i = src.indexOf('`', i + 1);
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) break;
    if (i < 0) return src;
  }
  const cut = src.slice(m.index, i + 1);
  return src.slice(0, m.index) + cut.replace(/[^\n]/g, '') + src.slice(i + 1);
}

/** Сколько строк в начале склеенного файла занимает служебная шапка — чтобы сдвигать номера строк в ошибках. */
export function mergeGo(user: string, extras: string[] = []): { code: string; userOffset: number; userLines: number } {
  const u = splitGo(user);
  const files = [u, ...extras.map(splitGo)];
  const imps = [...new Set(files.flatMap((f) => f.imports))];
  const header = `package main\n${imps.length ? `import (\n${imps.map((i) => '\t' + i).join('\n')}\n)\n` : ''}`;
  // Сохраняем положение строк ученика: считаем, сколько строк было до тела в исходнике.
  const userPrefixLines = user.split('\n').length - u.body.split('\n').length;
  const headerLines = header.split('\n').length - 1;
  const code = header + files.map((f) => f.body).join('\n');
  return { code, userOffset: headerLines - userPrefixLines, userLines: user.split('\n').length };
}

/** Переписывает "12:5: ..." в ошибке yaegi на номера строк в коде ученика. */
export function fixGoErrorLines(msg: string, offset: number, userLines: number): string {
  return msg.replace(/(^|\s|\(|_\.go:)(\d+):(\d+)/g, (all, pre, l, c) => {
    pre = pre === '_.go:' ? '' : pre;
    const line = Number(l) - offset;
    if (line < 1) return all;
    if (line > userLines) return `${pre}[код проверки]`;
    return `${pre}строка ${line}, позиция ${c}`;
  });
}

/** Пролог харнесса: функции для проверок. Харнесс печатает строки @@PASS/@@FAIL. */
export const GO_HARNESS_PRELUDE = `
func dojoCheck(name string, got, want any) {
	if __dojoReflect.DeepEqual(got, want) {
		__dojoFmt.Printf("\\n@@PASS %s\\n", name)
	} else {
		__dojoFmt.Printf("\\n@@FAIL %s\\x1fполучено: %#v\\x1fожидалось: %#v\\n", name, got, want)
	}
}

func dojoAssert(name string, ok bool, msg string) {
	if ok {
		__dojoFmt.Printf("\\n@@PASS %s\\n", name)
	} else {
		__dojoFmt.Printf("\\n@@FAIL %s\\x1f%s\\n", name, msg)
	}
}
`;
export const GO_PRELUDE_IMPORTS = `package main
import (
	__dojoFmt "fmt"
	__dojoReflect "reflect"
)
`;
