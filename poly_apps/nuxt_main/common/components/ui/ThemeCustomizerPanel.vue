<template>
    <div>
        <div
            class="fixed inset-0 z-[51] hidden bg-[black]/60 px-4 transition-[display]"
            :class="{ '!block': showCustomizer }"
            @click="showCustomizer = false"
        ></div>

        <nav
            class="fixed top-0 bottom-0 z-[51] w-full max-w-[400px] bg-white p-4 shadow-[5px_0_25px_0_rgba(94,92,154,0.1)] transition-[right] duration-300 ltr:-right-[400px] rtl:-left-[400px] dark:bg-[#0e1726]"
            :class="{ 'ltr:!right-0 rtl:!left-0': showCustomizer }"
        >
            <a
                href="javascript:;"
                class="absolute top-0 bottom-0 my-auto flex h-10 w-12 cursor-pointer items-center justify-center bg-primary text-white ltr:-left-12 ltr:rounded-tl-full ltr:rounded-bl-full rtl:-right-12 rtl:rounded-tr-full rtl:rounded-br-full"
                @click="showCustomizer = !showCustomizer"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 animate-[spin_3s_linear_infinite]"
                >
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" />
                    <path
                        opacity="0.5"
                        d="M13.7654 2.15224C13.3978 2 12.9319 2 12 2C11.0681 2 10.6022 2 10.2346 2.15224C9.74457 2.35523 9.35522 2.74458 9.15223 3.23463C9.05957 3.45834 9.0233 3.7185 9.00911 4.09799C8.98826 4.65568 8.70226 5.17189 8.21894 5.45093C7.73564 5.72996 7.14559 5.71954 6.65219 5.45876C6.31645 5.2813 6.07301 5.18262 5.83294 5.15102C5.30704 5.08178 4.77518 5.22429 4.35436 5.5472C4.03874 5.78938 3.80577 6.1929 3.33983 6.99993C2.87389 7.80697 2.64092 8.21048 2.58899 8.60491C2.51976 9.1308 2.66227 9.66266 2.98518 10.0835C3.13256 10.2756 3.3397 10.437 3.66119 10.639C4.1338 10.936 4.43789 11.4419 4.43786 12C4.43783 12.5581 4.13375 13.0639 3.66118 13.3608C3.33965 13.5629 3.13248 13.7244 2.98508 13.9165C2.66217 14.3373 2.51966 14.8691 2.5889 15.395C2.64082 15.7894 2.87379 16.193 3.33973 17C3.80568 17.807 4.03865 18.2106 4.35426 18.4527C4.77508 18.7756 5.30694 18.9181 5.83284 18.8489C6.07289 18.8173 6.31632 18.7186 6.65204 18.5412C7.14547 18.2804 7.73556 18.27 8.2189 18.549C8.70224 18.8281 8.98826 19.3443 9.00911 19.9021C9.02331 20.2815 9.05957 20.5417 9.15223 20.7654C9.35522 21.2554 9.74457 21.6448 10.2346 21.8478C10.6022 22 11.0681 22 12 22C12.9319 22 13.3978 22 13.7654 21.8478C14.2554 21.6448 14.6448 21.2554 14.8477 20.7654C14.9404 20.5417 14.9767 20.2815 14.9909 19.902C15.0117 19.3443 15.2977 18.8281 15.781 18.549C16.2643 18.2699 16.8544 18.2804 17.3479 18.5412C17.6836 18.7186 17.927 18.8172 18.167 18.8488C18.6929 18.9181 19.2248 18.7756 19.6456 18.4527C19.9612 18.2105 20.1942 17.807 20.6601 16.9999C21.1261 16.1929 21.3591 15.7894 21.411 15.395C21.4802 14.8691 21.3377 14.3372 21.0148 13.9164C20.8674 13.7243 20.6602 13.5628 20.3387 13.3608C19.8662 13.0639 19.5621 12.558 19.5621 11.9999C19.5621 11.4418 19.8662 10.9361 20.3387 10.6392C20.6603 10.4371 20.8675 10.2757 21.0149 10.0835C21.3378 9.66273 21.4803 9.13087 21.4111 8.60497C21.3592 8.21055 21.1262 7.80703 20.6602 7C20.1943 6.19297 19.9613 5.78945 19.6457 5.54727C19.2249 5.22436 18.693 5.08185 18.1671 5.15109C17.9271 5.18269 17.6837 5.28136 17.3479 5.4588C16.8545 5.71959 16.2644 5.73002 15.7811 5.45096C15.2977 5.17191 15.0117 4.65566 14.9909 4.09794C14.9767 3.71848 14.9404 3.45833 14.8477 3.23463C14.6448 2.74458 14.2554 2.35523 13.7654 2.15224Z"
                        stroke="currentColor"
                        stroke-width="1.5"
                    />
                </svg>
            </a>
            <client-only>
                <perfect-scrollbar
                    :options="{
                        swipeEasing: true,
                        wheelPropagation: false,
                    }"
                    class="relative -mr-3 h-full overflow-x-hidden pr-3"
                >
                    <div>
                        <div class="relative pb-5 text-center">
                            <a
                                href="javascript:;"
                                class="absolute top-0 opacity-30 hover:opacity-100 ltr:right-0 rtl:left-0 dark:text-white"
                                @click="showCustomizer = false"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24px"
                                    height="24px"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </a>
                            <h4 class="text-primary">( Customize your demo )</h4>

                            <p class="text-white-dark">Make your demo awesome 😎</p>
                        </div>

                        <div class="mb-3">
                            <h5 class="mb-1 text-base leading-none dark:text-white">Color Scheme</h5>
                            <p class="text-xs text-white-dark">Overall light or dark presentation.</p>
                            <div class="mt-3 flex items-center gap-3 text-primary">
                                <button
                                    type="button"
                                    class="btn flex-auto"
                                    :class="[config.theme === 'light' ? 'btn-primary' : 'btn-outline-primary']"
                                    @click="setTheme('light')"
                                >
                                    Light
                                </button>
                                <button
                                    type="button"
                                    class="btn flex-auto"
                                    :class="[config.theme === 'dark' ? 'btn-primary' : 'btn-outline-primary']"
                                    @click="setTheme('dark')"
                                >
                                    Dark
                                </button>
                                <button
                                    type="button"
                                    class="btn flex-auto"
                                    :class="[config.theme === 'system' ? 'btn-primary' : 'btn-outline-primary']"
                                    @click="setTheme('system')"
                                >
                                    System
                                </button>
                            </div>
                        </div>

                        <div class="mb-3 rounded-md border border-dashed border-[#e0e6ed] p-3 dark:border-[#1b2e4b]">
                            <h5 class="mb-1 text-base leading-none dark:text-white">Theme</h5>
                            <p class="text-xs text-white-dark">Adjust the overall look of your theme.</p>
                            <div class="theme-colors mt-3 grid grid-cols-3 gap-2 text-primary sm:grid-cols-3">
                                <div>
                                    <input
                                        id="color-scheme-light"
                                        type="radio"
                                        name="theme"
                                        value="light"
                                        class="themeBg"
                                        :checked="config.theme === 'light'"
                                        @change="setTheme('light')"
                                    />
                                    <label for="color-scheme-light" class="mb-1 rounded-md border border-white-light bg-white">Light</label>
                                </div>
                                <div>
                                    <input
                                        id="color-scheme-dark"
                                        type="radio"
                                        name="theme"
                                        value="dark"
                                        class="themeBg"
                                        :checked="config.theme === 'dark'"
                                        @change="setTheme('dark')"
                                    />
                                    <label
                                        for="color-scheme-dark"
                                        class="mb-1 rounded-md border border-white-light bg-[#0e1726] text-white-light dark:border-[#0e1726]"
                                        >Dark</label
                                    >
                                </div>
                                <div>
                                    <input
                                        id="color-scheme-auto"
                                        type="radio"
                                        name="theme"
                                        value="system"
                                        class="themeBg"
                                        :checked="config.theme === 'system'"
                                        @change="setTheme('system')"
                                    />
                                    <label
                                        for="color-scheme-auto"
                                        class="mb-1 rounded-md border border-white-light bg-slate-900/10 text-slate-900 dark:border-white/10 dark:bg-slate-100/20 dark:text-white"
                                        >System</label
                                    >
                                </div>
                            </div>
                        </div>

                        <div class="mb-3 rounded-md border border-dashed border-[#e0e6ed] p-3 dark:border-[#1b2e4b]">
                            <div class="flex items-start justify-between">
                                <h5 class="mb-1 text-base leading-none dark:text-white">Menu Type</h5>
                                <label class="w-1/2 cursor-pointer">
                                    <input v-model="semidarkModel" type="checkbox" class="form-checkbox" />
                                    <span class="text-white-dark">Semidark Layout</span>
                                </label>
                            </div>
                            <p class="text-xs text-white-dark">Disclosure for header navigation.</p>
                            <div class="mt-3 flex items-center gap-3 text-primary">
                                <button
                                    type="button"
                                    class="btn flex-auto"
                                    :class="[config.menu === 'horizontal' ? 'btn-primary' : 'btn-outline-primary']"
                                    @click="setMenu('horizontal')"
                                >
                                    Horizontal
                                </button>
                                <button
                                    type="button"
                                    class="btn flex-auto"
                                    :class="[config.menu === 'vertical' ? 'btn-primary' : 'btn-outline-primary']"
                                    @click="setMenu('vertical')"
                                >
                                    Vertical
                                </button>
                                <button
                                    type="button"
                                    class="btn flex-auto"
                                    :class="[config.menu === 'collapsible-vertical' ? 'btn-primary' : 'btn-outline-primary']"
                                    @click="setMenu('collapsible-vertical')"
                                >
                                    Collapsible
                                </button>
                            </div>
                        </div>

                        <div class="mb-3 rounded-md border border-dashed border-[#e0e6ed] p-3 dark:border-[#1b2e4b]">
                            <h5 class="mb-1 text-base leading-none dark:text-white">Layout Style</h5>
                            <p class="text-xs text-white-dark">See all your layouts in a single place.</p>
                            <div class="mt-3 flex items-center gap-3 text-primary">
                                <button
                                    type="button"
                                    class="btn flex-auto"
                                    :class="[config.layout === 'boxed-layout' ? 'btn-primary' : 'btn-outline-primary']"
                                    @click="setLayout('boxed-layout')"
                                >
                                    Box
                                </button>
                                <button
                                    type="button"
                                    class="btn flex-auto"
                                    :class="[config.layout === 'full' ? 'btn-primary' : 'btn-outline-primary']"
                                    @click="setLayout('full')"
                                >
                                    Full
                                </button>
                            </div>
                        </div>

                        <div class="mb-3 rounded-md border border-dashed border-[#e0e6ed] p-3 dark:border-[#1b2e4b]">
                            <h5 class="mb-1 text-base leading-none dark:text-white">Direction</h5>
                            <p class="text-xs text-white-dark">Choose your direction</p>
                            <div class="mt-3 flex items-center gap-3 text-primary">
                                <button
                                    type="button"
                                    class="btn flex-auto"
                                    :class="[config.rtlClass === 'ltr' ? 'btn-primary' : 'btn-outline-primary']"
                                    @click="setRTL('ltr')"
                                >
                                    LTR
                                </button>
                                <button
                                    type="button"
                                    class="btn flex-auto"
                                    :class="[config.rtlClass === 'rtl' ? 'btn-primary' : 'btn-outline-primary']"
                                    @click="setRTL('rtl')"
                                >
                                    RTL
                                </button>
                            </div>
                        </div>

                        <div class="mb-3 rounded-md border border-dashed border-[#e0e6ed] p-3 dark:border-[#1b2e4b]">
                            <h5 class="mb-1 text-base leading-none dark:text-white">Navbar Type</h5>
                            <p class="text-xs text-white-dark">Sticky or Floating.</p>
                            <div class="mt-3 flex items-center gap-3 text-primary">
                                <label class="mb-0 inline-flex">
                                    <input
                                        :checked="config.navbar === 'navbar-sticky'"
                                        type="radio"
                                        value="navbar-sticky"
                                        class="form-radio"
                                        @change="setNavbar('navbar-sticky')"
                                    />
                                    <span>Sticky</span>
                                </label>
                                <label class="mb-0 inline-flex">
                                    <input
                                        :checked="config.navbar === 'navbar-floating'"
                                        type="radio"
                                        value="navbar-floating"
                                        class="form-radio"
                                        @change="setNavbar('navbar-floating')"
                                    />
                                    <span>Floating</span>
                                </label>
                                <label class="mb-0 inline-flex">
                                    <input
                                        :checked="config.navbar === 'navbar-static'"
                                        type="radio"
                                        value="navbar-static"
                                        class="form-radio"
                                        @change="setNavbar('navbar-static')"
                                    />
                                    <span>Static</span>
                                </label>
                            </div>
                        </div>

                        <div class="mb-3 rounded-md border border-dashed border-[#e0e6ed] p-3 dark:border-[#1b2e4b]">
                            <h5 class="mb-1 text-base leading-none dark:text-white">Router Transition</h5>
                            <p class="text-xs text-white-dark">Animation of main content.</p>
                            <div class="mt-3">
                                <select v-model="animationModel" class="form-select border-primary text-primary">
                                    <option value="">Select Animation</option>
                                    <option value="animate__fadeIn">Fade</option>
                                    <option value="animate__fadeInDown">Fade Down</option>
                                    <option value="animate__fadeInUp">Fade Up</option>
                                    <option value="animate__fadeInLeft">Fade Left</option>
                                    <option value="animate__fadeInRight">Fade Right</option>
                                    <option value="animate__slideInDown">Slide Down</option>
                                    <option value="animate__slideInLeft">Slide Left</option>
                                    <option value="animate__slideInRight">Slide Right</option>
                                    <option value="animate__zoomIn">Zoom In</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </perfect-scrollbar>
            </client-only>
        </nav>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useGlobalConfig } from '@/common/composables/useGlobalConfig';

const showCustomizer = ref(false);
const { config, setTheme, setMenu, setLayout, setRTL, setNavbar, setSemidark, setAnimation } = useGlobalConfig();

const semidarkModel = computed({
    get: () => config.value.semidark,
    set: (value: boolean) => setSemidark(value),
});

const animationModel = computed({
    get: () => config.value.animation,
    set: (value: string) => setAnimation(value || ''),
});
</script>
