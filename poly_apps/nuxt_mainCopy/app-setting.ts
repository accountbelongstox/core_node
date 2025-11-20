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

import { $themeConfig } from './theme.config';
import { useAppStore } from '@/stores/index';

export default {
    init(setLocale: any) {
        const store = useAppStore();

        // set default styles
        let val: any = localStorage.getItem('theme'); // light, dark, system
        val = val || $themeConfig.theme;
        store.toggleTheme(val);

        val = localStorage.getItem('menu'); // vertical, collapsible-vertical, horizontal
        val = val || $themeConfig.menu;
        store.toggleMenu(val);

        val = localStorage.getItem('layout'); // full, boxed-layout
        val = val || $themeConfig.layout;
        store.toggleLayout(val);

        val = localStorage.getItem('i18n_locale'); // en, da, de, el, es, fr, hu, it, ja, pl, pt, ru, sv, tr, zh

        val = val || $themeConfig.locale;

        const list = store.languageList;
        const item = list.find((item: any) => item.code === val);
        if (item) {
            this.toggleLanguage(item, setLocale);
        }

        val = localStorage.getItem('rtlClass'); // rtl, ltr
        val = val || $themeConfig.rtlClass;
        store.toggleRTL(val);

        val = localStorage.getItem('animation'); // animate__fadeIn, animate__fadeInDown, animate__fadeInUp, animate__fadeInLeft, animate__fadeInRight, animate__slideInDown, animate__slideInLeft, animate__slideInRight, animate__zoomIn
        val = val || $themeConfig.animation;
        store.toggleAnimation(val);

        val = localStorage.getItem('navbar'); // navbar-sticky, navbar-floating, navbar-static
        val = val || $themeConfig.navbar;
        store.toggleNavbar(val);

        val = localStorage.getItem('semidark');
        val = val === 'true' ? true : $themeConfig.semidark;
        store.toggleSemidark(val);
    },

    toggleLanguage(item: any, setLocale: any) {
        const store = useAppStore();

        let lang: any = null;
        if (item) {
            lang = item;
        } else {
            let code = store.locale || null;
            if (!code) {
                code = localStorage.getItem('i18n_locale');
            }

            item = store.languageList.find((d: any) => d.code === code);
            if (item) {
                lang = item;
            }
        }

        if (!lang) {
            lang = store.languageList.find((d: any) => d.code === 'en');
        }

        store.toggleLocale(lang.code, setLocale);
        return lang;
    },

    changeAnimation(type = 'add') {
        const store = useAppStore();
        if (store.animation) {
            const eleanimation: any = document.querySelector('.animation');
            if (type === 'add') {
                eleanimation?.classList.add('animate__animated');
                eleanimation?.classList.add(store.animation);
            } else {
                eleanimation?.classList.remove('animate__animated');
                eleanimation?.classList.remove(store.animation);
            }
        }
    },
};
