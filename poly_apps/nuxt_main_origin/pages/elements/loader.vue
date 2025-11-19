<template>
    <div>
        <ul class="flex space-x-2 rtl:space-x-reverse">
            <li>
                <a href="javascript:;" class="text-primary hover:underline">Elements</a>
            </li>
            <li class="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                <span>Loader</span>
            </li>
        </ul>
        <div class="grid grid-cols-1 gap-6 pt-5 lg:grid-cols-2">
            <div class="panel">
                <div class="mb-5 flex items-center justify-between">
                    <h5 class="text-lg font-semibold dark:text-white-light">Loaders with Buttons</h5>
                    <a class="font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600" href="javascript:;" @click="toggleCode('code1')"
                        ><span class="flex items-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2">
                                <path
                                    d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                                <path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                <path
                                    d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                            </svg>
                            Code
                        </span></a
                    >
                </div>
                <div class="mb-5">
                    <div class="flex w-full flex-wrap items-center justify-center gap-4">
                        <button type="button" class="btn btn-info btn-lg">
                            <svg
                                viewBox="0 0 24 24"
                                width="24"
                                height="24"
                                stroke="currentColor"
                                stroke-width="1.5"
                                fill="none"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="inline-block h-5 w-5 animate-[spin_2s_linear_infinite] align-middle ltr:mr-2 rtl:ml-2"
                            >
                                <line x1="12" y1="2" x2="12" y2="6"></line>
                                <line x1="12" y1="18" x2="12" y2="22"></line>
                                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                                <line x1="2" y1="12" x2="6" y2="12"></line>
                                <line x1="18" y1="12" x2="22" y2="12"></line>
                                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                            </svg>
                            Loading
                        </button>

                        <button type="button" class="btn btn-danger btn-lg">
                            <span
                                class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-l-transparent align-middle ltr:mr-4 rtl:ml-4"
                            ></span
                            >Loading
                        </button>

                        <button type="button" class="btn btn-secondary btn-lg">
                            <span class="inline-block h-3 w-3 animate-ping rounded-full bg-white ltr:mr-4 rtl:ml-4"></span>
                            Loading
                        </button>
                    </div>
                </div>
                <template v-if="codeArr.includes('code1')">
                    <highlight>
                        <pre>
&lt;!-- info --&gt;
&lt;button type=&quot;button&quot; class=&quot;btn btn-info btn-lg&quot;&gt;
  &lt;svg&gt; ... &lt;/svg&gt;
  Loading
&lt;/button&gt;

&lt;button type=&quot;button&quot; class=&quot;btn btn-danger btn-lg&quot;&gt;
  &lt;span class=&quot;animate-spin border-2 border-white border-l-transparent rounded-full w-5 h-5 ltr:mr-4 rtl:ml-4 inline-block align-middle&quot;&gt;&lt;/span&gt;Loading
&lt;/button&gt;

&lt;button type=&quot;button&quot; class=&quot;btn btn-secondary btn-lg&quot;&gt;
  &lt;span class=&quot;animate-ping w-3 h-3 ltr:mr-4 rtl:ml-4 inline-block rounded-full bg-white&quot;&gt;&lt;/span&gt;
  Loading
&lt;/button&gt;
</pre
                        >
                    </highlight>
                </template>
            </div>

            <div class="panel">
                <div class="mb-5 flex items-center justify-between">
                    <h5 class="text-lg font-semibold dark:text-white-light">Position</h5>
                    <a class="font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600" href="javascript:;" @click="toggleCode('code2')"
                        ><span class="flex items-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2">
                                <path
                                    d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                                <path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                <path
                                    d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                            </svg>
                            Code
                        </span></a
                    >
                </div>
                <div class="mb-5">
                    <div class="flex w-full flex-wrap">
                        <div class="mb-3 flex w-full flex-wrap items-center justify-center text-center sm:mb-0 sm:w-1/2">
                            <p class="mb-2 w-full">Default Button</p>
                            <button type="button" class="btn btn-primary btn-lg">
                                <svg
                                    viewBox="0 0 24 24"
                                    width="24"
                                    height="24"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    fill="none"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    class="inline-block h-5 w-5 animate-[spin_2s_linear_infinite] align-middle ltr:mr-2 rtl:ml-2"
                                >
                                    <line x1="12" y1="2" x2="12" y2="6"></line>
                                    <line x1="12" y1="18" x2="12" y2="22"></line>
                                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                                    <line x1="2" y1="12" x2="6" y2="12"></line>
                                    <line x1="18" y1="12" x2="22" y2="12"></line>
                                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                                </svg>
                                Loading
                            </button>
                        </div>
                        <div class="flex w-full flex-wrap items-center justify-center text-center sm:w-1/2">
                            <p class="mb-2 w-full">Outline Button</p>
                            <button type="button" class="btn btn-outline-primary btn-lg">
                                Loading
                                <svg
                                    viewBox="0 0 24 24"
                                    width="24"
                                    height="24"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    fill="none"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    class="inline-block h-5 w-5 animate-[spin_2s_linear_infinite] align-middle ltr:ml-2 rtl:mr-2"
                                >
                                    <line x1="12" y1="2" x2="12" y2="6"></line>
                                    <line x1="12" y1="18" x2="12" y2="22"></line>
                                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                                    <line x1="2" y1="12" x2="6" y2="12"></line>
                                    <line x1="18" y1="12" x2="22" y2="12"></line>
                                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                <template v-if="codeArr.includes('code2')">
                    <highlight>
                        <pre>
&lt;!-- default --&gt;
&lt;div class=&quot;flex flex-wrap items-center justify-center w-full sm:w-1/2 text-center mb-3 sm:mb-0&quot;&gt;
  &lt;p class=&quot;w-full mb-2&quot;&gt;Default Button&lt;/p&gt;
  &lt;button type=&quot;button&quot; class=&quot;btn btn-primary btn-lg&quot;&gt;
    &lt;svg&gt; ... &lt;/svg&gt;
    Loading
  &lt;/button&gt;
&lt;/div&gt;

&lt;!-- outline --&gt;
&lt;div class=&quot;flex flex-wrap items-center justify-center w-full sm:w-1/2 text-center&quot;&gt;
  &lt;p class=&quot;w-full mb-2&quot;&gt;Outline Button&lt;/p&gt;
  &lt;button type=&quot;button&quot; class=&quot;btn btn-outline-primary btn-lg&quot;&gt;
    Loading
    &lt;svg&gt; ... &lt;/svg&gt;
  &lt;/button&gt;
&lt;/div&gt;
</pre
                        >
                    </highlight>
                </template>
            </div>

            <div class="panel">
                <div class="mb-10 flex items-center justify-between">
                    <h5 class="text-lg font-semibold dark:text-white-light">Sizes</h5>
                    <a class="font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600" href="javascript:;" @click="toggleCode('code3')"
                        ><span class="flex items-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2">
                                <path
                                    d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                                <path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                <path
                                    d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                            </svg>
                            Code
                        </span></a
                    >
                </div>
                <div class="mb-5">
                    <div class="grid w-full grid-cols-3 gap-4">
                        <span
                            class="m-auto mb-10 inline-block h-12 w-12 animate-spin rounded-full border-4 border-success border-l-transparent align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-10 w-10 animate-spin rounded-full border-4 border-success border-l-transparent align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-success border-l-transparent align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-12 w-12 animate-spin rounded-full border-4 border-transparent border-l-primary align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-10 w-10 animate-spin rounded-full border-4 border-transparent border-l-primary align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-transparent border-l-primary align-middle"
                        ></span>
                        <span class="m-auto mb-10 h-5 w-5"><span class="inline-flex h-full w-full animate-ping rounded-full bg-info"></span></span>
                        <span class="m-auto mb-10 h-4 w-4"><span class="inline-flex h-full w-full animate-ping rounded-full bg-info"></span></span>
                        <span class="m-auto mb-10 h-3 w-3"><span class="inline-flex h-full w-full animate-ping rounded-full bg-info"></span></span>
                    </div>
                </div>
                <template v-if="codeArr.includes('code3')">
                    <highlight>
                        <pre>
&lt;!-- large --&gt;
&lt;span class=&quot;animate-spin border-4 border-success border-l-transparent rounded-full w-12 h-12 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- default --&gt;
&lt;span class=&quot;animate-spin border-4 border-success border-l-transparent rounded-full w-10 h-10 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- small --&gt;
&lt;span class=&quot;animate-spin border-[3px] border-success border-l-transparent rounded-full w-6 h-6 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- large --&gt;
&lt;span class=&quot;animate-spin border-4 border-transparent border-l-primary rounded-full w-12 h-12 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- default --&gt;
&lt;span class=&quot;animate-spin border-4 border-transparent border-l-primary rounded-full w-10 h-10 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- small --&gt;
&lt;span class=&quot;animate-spin border-[3px] border-transparent border-l-primary rounded-full w-6 h-6 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- large --&gt;
&lt;span class=&quot;w-5 h-5 m-auto mb-10&quot;&gt;&lt;span class=&quot;animate-ping inline-flex h-full w-full rounded-full bg-info&quot;&gt;&lt;/span&gt;&lt;/span&gt;

&lt;!-- default --&gt;
&lt;span class=&quot;w-4 h-4 m-auto mb-10&quot;&gt;&lt;span class=&quot;animate-ping inline-flex h-full w-full rounded-full bg-info&quot;&gt;&lt;/span&gt;&lt;/span&gt;

&lt;!-- small --&gt;
&lt;span class=&quot;w-3 h-3 m-auto mb-10&quot;&gt;&lt;span class=&quot;animate-ping inline-flex h-full w-full rounded-full bg-info&quot;&gt;&lt;/span&gt;&lt;/span&gt;
</pre
                        >
                    </highlight>
                </template>
            </div>

            <div class="panel">
                <div class="mb-10 flex items-center justify-between">
                    <h5 class="text-lg font-semibold dark:text-white-light">Colors</h5>
                    <a class="font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600" href="javascript:;" @click="toggleCode('code4')"
                        ><span class="flex items-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2">
                                <path
                                    d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                                <path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                <path
                                    d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                            </svg>
                            Code
                        </span></a
                    >
                </div>
                <div class="mb-5">
                    <div class="grid w-full grid-cols-4 gap-4">
                        <span
                            class="m-auto mb-10 inline-block h-10 w-10 animate-spin rounded-full border-4 border-success border-l-transparent align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-10 w-10 animate-spin rounded-full border-4 border-danger border-l-transparent align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-10 w-10 animate-spin rounded-full border-4 border-warning border-l-transparent align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-10 w-10 animate-spin rounded-full border-4 border-primary border-l-transparent align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-10 w-10 animate-spin rounded-full border-4 border-transparent border-l-black align-middle dark:border-l-dark"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-10 w-10 animate-spin rounded-full border-4 border-transparent border-l-danger align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-10 w-10 animate-spin rounded-full border-4 border-transparent border-l-warning align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-10 w-10 animate-spin rounded-full border-4 border-transparent border-l-primary align-middle"
                        ></span>
                        <span class="m-auto mb-10 h-4 w-4"><span class="inline-flex h-full w-full animate-ping rounded-full bg-info"></span></span>
                        <span class="m-auto mb-10 h-4 w-4"><span class="inline-flex h-full w-full animate-ping rounded-full bg-danger"></span></span>
                        <span class="m-auto mb-10 h-4 w-4"><span class="inline-flex h-full w-full animate-ping rounded-full bg-warning"></span></span>
                        <span class="m-auto mb-10 h-4 w-4"><span class="inline-flex h-full w-full animate-ping rounded-full bg-primary"></span></span>
                    </div>
                </div>
                <template v-if="codeArr.includes('code4')">
                    <highlight>
                        <pre>
&lt;!-- success --&gt;
&lt;span class=&quot;animate-spin border-4 border-success border-l-transparent rounded-full w-10 h-10 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- danger --&gt;
&lt;span class=&quot;animate-spin border-4 border-danger border-l-transparent rounded-full w-10 h-10 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- warning --&gt;
&lt;span class=&quot;animate-spin border-4 border-warning border-l-transparent rounded-full w-10 h-10 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- primary --&gt;
&lt;span class=&quot;animate-spin border-4 border-primary border-l-transparent rounded-full w-10 h-10 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- black --&gt;
&lt;span class=&quot;animate-spin border-4 border-transparent border-l-black rounded-full w-10 h-10 inline-block align-middle m-auto mb-10 dark:border-l-dark&quot;&gt;&lt;/span&gt;

&lt;!-- danger --&gt;
&lt;span class=&quot;animate-spin border-4 border-transparent border-l-danger rounded-full w-10 h-10 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- warning --&gt;
&lt;span class=&quot;animate-spin border-4 border-transparent border-l-warning rounded-full w-10 h-10 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- primary --&gt;
&lt;span class=&quot;animate-spin border-4 border-transparent border-l-primary rounded-full w-10 h-10 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- info --&gt;
&lt;span class=&quot;w-4 h-4 m-auto mb-10&quot;&gt;&lt;span class=&quot;animate-ping inline-flex h-full w-full rounded-full bg-info&quot;&gt;&lt;/span&gt;&lt;/span&gt;

&lt;!-- danger --&gt;
&lt;span class=&quot;w-4 h-4 m-auto mb-10&quot;&gt;&lt;span class=&quot;animate-ping inline-flex h-full w-full rounded-full bg-danger&quot;&gt;&lt;/span&gt;&lt;/span&gt;

&lt;!-- warning --&gt;
&lt;span class=&quot;w-4 h-4 m-auto mb-10&quot;&gt;&lt;span class=&quot;animate-ping inline-flex h-full w-full rounded-full bg-warning&quot;&gt;&lt;/span&gt;&lt;/span&gt;

&lt;!-- primary --&gt;
&lt;span class=&quot;w-4 h-4 m-auto mb-10&quot;&gt;&lt;span class=&quot;animate-ping inline-flex h-full w-full rounded-full bg-primary&quot;&gt;&lt;/span&gt;&lt;/span&gt;
</pre
                        >
                    </highlight>
                </template>
            </div>

            <div class="panel">
                <div class="mb-10 flex items-center justify-between">
                    <h5 class="text-lg font-semibold dark:text-white-light">Custom</h5>
                    <a class="font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600" href="javascript:;" @click="toggleCode('code5')">
                        <span class="flex items-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2">
                                <path
                                    d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                                <path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                <path
                                    d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                            </svg>
                            Code
                        </span>
                    </a>
                </div>
                <div class="mb-5">
                    <div class="grid w-full grid-cols-3 gap-4">
                        <span
                            class="m-auto mb-10 inline-block h-14 w-14 animate-spin rounded-full border-8 border-[#f1f2f3] border-l-primary align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-14 w-14 animate-[spin_2s_linear_infinite] rounded-full border-8 border-[#f1f2f3] border-l-primary border-r-primary align-middle"
                        ></span>
                        <span
                            class="m-auto mb-10 inline-block h-14 w-14 animate-[spin_3s_linear_infinite] rounded-full border-8 border-r-warning border-l-primary border-t-danger border-b-success align-middle"
                        ></span>
                    </div>
                </div>
                <template v-if="codeArr.includes('code5')">
                    <highlight>
                        <pre>
&lt;!-- custom loader --&gt;
&lt;span class=&quot;animate-spin border-8 border-[#f1f2f3] border-l-primary rounded-full w-14 h-14 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- custom loader --&gt
&lt;span class=&quot;animate-[spin_2s_linear_infinite] border-8 border-[#f1f2f3] border-l-primary border-r-primary rounded-full w-14 h-14 inline-block align-middle m-auto mb-10&quot;&gt;&lt;/span&gt;

&lt;!-- custom loader --&gt
&lt;span
  class=&quot;animate-[spin_3s_linear_infinite] border-8 border-r-warning border-l-primary border-t-danger border-b-success rounded-full w-14 h-14 inline-block align-middle m-auto mb-10&quot;
&gt;&lt;/span&gt;
</pre
                        >
                    </highlight>
                </template>
            </div>
        </div>
    </div>
</template>
<script lang="ts" setup>
    import highlight from '@/components/plugins/highlight.vue';
    import codePreview from '@/composables/codePreview';
    useHead({ title: 'Loader' });

    const { codeArr, toggleCode } = codePreview();
</script>
