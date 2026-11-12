// GitHub Pages ne connaît pas les routes de l'application (/draftmaster/home, /draftmaster/team…) :
// on copie index.html en 404.html pour qu'un lien direct ou un rechargement ouvre quand même l'application.
import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../dist/index.html', import.meta.url), new URL('../dist/404.html', import.meta.url));
console.log('dist/404.html créé');
