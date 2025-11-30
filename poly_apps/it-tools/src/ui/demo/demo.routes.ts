// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import type { RouteRecordRaw } from 'vue-router';
import DemoHome from './demo-home.page.vue';

const demoPages = import.meta.glob('../*/*.demo.vue', { eager: true });

export const demoRoutes = Object.keys(demoPages).map((demoComponentPath) => {
  const [, , fileName] = demoComponentPath.split('/');
  const demoComponentName = fileName.split('.').shift();

  return {
    path: demoComponentName,
    name: demoComponentName,
    component: () => import(/* @vite-ignore */ demoComponentPath),
  } as RouteRecordRaw;
});

export const routes = [
  {
    path: '/c-lib',
    name: 'c-lib',
    children: [
      {
        path: '',
        name: 'c-lib-index',
        component: DemoHome,
      },
      ...demoRoutes,
    ],
    component: () => import('./demo-wrapper.vue'),
  },
];
