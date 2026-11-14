/** Régénère public/icons à partir de src/app/brand.ts. Usage : npm run brand:icons */
import { writeFileSync } from 'node:fs';
import { brandMarkSvg } from '../src/app/brand.ts';

const dir = new URL('../public/icons/', import.meta.url);
writeFileSync(new URL('icon.svg', dir), brandMarkSvg() + '\n');
writeFileSync(new URL('icon-maskable.svg', dir), brandMarkSvg({ maskable: true }) + '\n');
console.log('Icônes régénérées dans public/icons/');
