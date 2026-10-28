// Воркер C#-рантайма: .NET в WebAssembly + Roslyn (runtimes/cs). Модульный воркер: new Worker(url, { type: 'module' }).
import { dotnet } from './_framework/dotnet.js';

let runner = null;

async function boot() {
  const rt = await dotnet
    .withApplicationCulture('ru-RU')
    .withConfig({ loadAllSatelliteResources: true }) // русские сообщения компилятора
    .withModuleConfig({
      onDownloadResourceProgress: (loaded, total) => self.postMessage({ type: 'progress', loaded, total }),
    })
    .create();
  await rt.runMain();
  runner = (await rt.getAssemblyExports('CsRunner.dll')).Runner;
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      await boot();
      // прогрев: первая компиляция у Roslyn самая долгая
      await runner.Run(['System.Console.Write("");'], '');
      self.postMessage({ type: 'ready' });
    } else if (msg.type === 'run') {
      const res = JSON.parse(await runner.Run(msg.files, msg.stdin ?? ''));
      self.postMessage({ type: 'result', id: msg.id, ...res });
    }
  } catch (err) {
    self.postMessage({ type: 'result', id: msg.id, crashed: true, output: '', errors: [], exception: { type: 'Crash', message: String(err && err.message ? err.message : err) } });
  }
};
