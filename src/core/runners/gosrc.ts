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
