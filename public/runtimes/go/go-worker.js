// Воркер Go-рантайма. Получает скомпилированный WebAssembly.Module, запускает yaegi.
importScripts('wasm_exec.js');

let mod = null;
let go = null;
let pending = null; // id текущего запуска

async function boot() {
  go = new Go();
  const ready = new Promise((r) => (self.dojoGoReady = r));
  const inst = await WebAssembly.instantiate(mod, go.importObject);
  const thisGo = go;
  thisGo.run(inst).then(() => {
    // Рантайм завершился сам — значит, паника в горутине или os.Exit.
    if (pending !== null) {
      self.postMessage({
        type: 'result',
        id: pending,
        stdout: '',
        stderr: '',
        error: 'Программа аварийно завершилась: паника в горутине (не в main) или os.Exit. Проверь горутины: nil map, выход за границы слайса, закрытый канал.',
      });
      pending = null;
    }
  });
  await ready;
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      mod = msg.module;
      await boot();
      self.postMessage({ type: 'ready' });
    } else if (msg.type === 'run') {
      if (!go || go.exited) await boot();
      pending = msg.id;
      self.dojoRunGo(msg.files, msg.stdin, (stdout, stderr, error) => {
        pending = null;
        self.postMessage({ type: 'result', id: msg.id, stdout, stderr, error });
      });
    }
  } catch (err) {
    pending = null;
    self.postMessage({ type: 'result', id: msg.id, stdout: '', stderr: '', error: String(err && err.message ? err.message : err) });
  }
};
