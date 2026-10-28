// Процесс-хозяин C#-рантайма для npm run check: читает задания построчно (JSON) из stdin, отвечает в stdout.
// Отдельный процесс нужен, чтобы бесконечный цикл в коде можно было прервать — родитель просто убьёт процесс.
import readline from 'node:readline';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const fw = path.resolve(process.argv[2], 'dotnet.js');
const { dotnet } = await import(pathToFileURL(fw).href);
const rt = await dotnet.withApplicationCulture('ru-RU').withConfig({ loadAllSatelliteResources: true }).create();
await rt.runMain();
const { Runner } = await rt.getAssemblyExports('CsRunner.dll');
// вывод самого рантайма (например, о StackOverflow) не должен смешиваться с ответами
const send = (o) => process.stdout.write('\u0001' + JSON.stringify(o) + '\n');
send({ ready: true });
for await (const line of readline.createInterface({ input: process.stdin })) {
  const { id, files, stdin } = JSON.parse(line);
  try {
    send({ id, ...JSON.parse(await Runner.Run(files, stdin)) });
  } catch (e) {
    send({ id, crashed: true, output: '', errors: [], exception: { type: 'Crash', message: String(e?.message ?? e) } });
  }
}
