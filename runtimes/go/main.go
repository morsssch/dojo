//go:build js && wasm

// Go-рантайм Dojo: интерпретатор yaegi, скомпилированный в WebAssembly.
// JS вызывает dojoRunGo(files, stdin, cb): files — массив исходников, которые
// выполняются по очереди в одном интерпретаторе (код ученика, затем проверяющий харнесс).
package main

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"syscall/js"
	"time"

	"github.com/traefik/yaegi/interp"

	"dojo/runtime/go/stdlib"
)

func run(files []string, stdin string) (stdout, stderr, errStr string) {
	var out, errb bytes.Buffer
	defer func() {
		stdout, stderr = out.String(), errb.String()
	}()
	i := interp.New(interp.Options{Stdout: &out, Stderr: &errb, Stdin: strings.NewReader(stdin), GoPath: "/go"})
	if err := i.Use(stdlib.Symbols); err != nil {
		return "", "", err.Error()
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	defer func() {
		if r := recover(); r != nil {
			errStr = fmt.Sprint("panic: ", r)
		}
	}()
	for n, src := range files {
		if _, err := i.EvalWithContext(ctx, src); err != nil {
			prefix := ""
			if n > 0 {
				prefix = "[проверка] "
			}
			return "", "", prefix + err.Error()
		}
	}
	return "", "", ""
}

func main() {
	js.Global().Set("dojoRunGo", js.FuncOf(func(this js.Value, args []js.Value) any {
		arr := args[0]
		files := make([]string, arr.Length())
		for k := range files {
			files[k] = arr.Index(k).String()
		}
		stdin, cb := args[1].String(), args[2]
		go func() {
			o, e, er := run(files, stdin)
			cb.Invoke(o, e, er)
		}()
		return nil
	}))
	js.Global().Call("dojoGoReady")
	select {}
}
