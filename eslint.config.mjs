import nextVitalsModule from 'eslint-config-next/core-web-vitals.js';
import prettier from 'eslint-config-prettier';

const nextVitals = Array.isArray(nextVitalsModule)
  ? nextVitalsModule
  : Array.isArray(nextVitalsModule.default)
    ? nextVitalsModule.default
    : [nextVitalsModule];

export default [...nextVitals, prettier];
