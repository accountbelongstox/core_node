import{d as k,u as w,r as h,h as b,k as t,q as i,c as g,s as v,v as s,l as r,b as a,x as y,y as x,g as l}from"./Cs8kveBG.js";import{c as C,h as f}from"./Bykx_eDL.js";import"./92s3wAHG.js";const _={class:"space-y-8 pt-5"},L={class:"grid grid-cols-1 gap-6 lg:grid-cols-2"},B={class:"panel"},q={class:"mb-5 flex items-center justify-between"},M={class:"markdown-editor prose mb-5 rtl:text-right dark:prose-invert"},V={class:"panel"},U={class:"mb-5 flex items-center justify-between"},j={class:"markdown-editor prose mb-5 rtl:text-right dark:prose-invert"},T=k({__name:"markdown-editor",setup(E){w({title:"Markdown Editor"});const{codeArr:n,toggleCode:d}=C(),u=h(`# Basic Example
Go ahead, play around with the editor! Be sure to check out **bold** and *italic* styling, or even[links](https://google.com). You can type the Markdown syntax, use the toolbar, or use shortcuts like 'cmd-b' or 'ctrl-b'.

## Lists
Unordered lists can be started using the toolbar or by typing '*', '-', or '+'. Ordered lists can be started by typing '1.'.

#### Unordered
* Lists are a piece of cake
* They even auto continue as you type
* A double enter will end them
* Tabs and shift - tabs work too

#### Ordered
1. Numbered lists...
2. ...work too!

## What about images?
![Yes](https://i.imgur.com/sZlktY7.png)`),c=h(`
# Autosaving!

Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

By default, it saves every 10 seconds, but this can be changed. When this textarea is included in a form, it will automatically forget the saved value when the form is submitted.
`);return(A,e)=>{const p=x("vue-easymde"),m=y;return l(),b("div",null,[e[11]||(e[11]=t("ul",{class:"flex space-x-2 rtl:space-x-reverse"},[t("li",null,[t("a",{href:"javascript:;",class:"text-primary hover:underline"},"Forms")]),t("li",{class:"before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"},[t("span",null,"Markdown Editor")])],-1)),t("div",_,[e[10]||(e[10]=i('<div class="panel flex items-center overflow-x-auto whitespace-nowrap p-3 text-primary"><div class="rounded-full bg-primary p-1.5 text-white ring-2 ring-primary/30 ltr:mr-3 rtl:ml-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5"><path d="M19.0001 9.7041V9C19.0001 5.13401 15.8661 2 12.0001 2C8.13407 2 5.00006 5.13401 5.00006 9V9.7041C5.00006 10.5491 4.74995 11.3752 4.28123 12.0783L3.13263 13.8012C2.08349 15.3749 2.88442 17.5139 4.70913 18.0116C9.48258 19.3134 14.5175 19.3134 19.291 18.0116C21.1157 17.5139 21.9166 15.3749 20.8675 13.8012L19.7189 12.0783C19.2502 11.3752 19.0001 10.5491 19.0001 9.7041Z" stroke="currentColor" stroke-width="1.5"></path><path opacity="0.5" d="M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></div><span class="ltr:mr-3 rtl:ml-3">Documentation: </span><a href="https://www.npmjs.com/package/vue3-easymde" target="_blank" class="block hover:underline">https://www.npmjs.com/package/vue3-easymde</a></div>',1)),t("div",L,[t("div",B,[t("div",q,[e[5]||(e[5]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Basic",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[0]||(e[0]=o=>s(d)("code1"))},e[4]||(e[4]=[i('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",M,[r(m,null,{default:a(()=>[r(p,{modelValue:u.value,"onUpdate:modelValue":e[1]||(e[1]=o=>u.value=o),ref:"editor1",highlight:!0,configs:{spellChecker:!1}},null,8,["modelValue"])]),_:1})]),s(n).includes("code1")?(l(),g(f,{key:0},{default:a(()=>e[6]||(e[6]=[t("pre",null,`  <!-- basic -->
  <vue-easymde v-model="content1" ref="editor1" :highlight="true" :configs="{ spellChecker: false }" />

  <!-- script -->
  <script lang="ts" setup>
    import { ref } from 'vue';
    const content1 = ref(\`# Basic Example
    Go ahead, play around with the editor! Be sure to check out **bold** and *italic* styling, or even[links](https://google.com). You can type the Markdown syntax, use the toolbar, or use shortcuts like 'cmd-b' or 'ctrl-b'.

    ## Lists
    Unordered lists can be started using the toolbar or by typing '*', '-', or '+'. Ordered lists can be started by typing '1.'.

    #### Unordered
    * Lists are a piece of cake
    * They even auto continue as you type
    * A double enter will end them
    * Tabs and shift - tabs work too

    #### Ordered
    1. Numbered lists...
    2. ...work too!

    ## What about images?
    ![Yes](https://i.imgur.com/sZlktY7.png)\`);
  <\/script>
  `,-1)])),_:1,__:[6]})):v("",!0)]),t("div",V,[t("div",U,[e[8]||(e[8]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Autosaving",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[2]||(e[2]=o=>s(d)("code2"))},e[7]||(e[7]=[i('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",j,[r(m,null,{default:a(()=>[r(p,{modelValue:c.value,"onUpdate:modelValue":e[3]||(e[3]=o=>c.value=o),ref:"editor2",highlight:!0,configs:{spellChecker:!1,autosave:{enabled:!0,delay:1e3,uniqueId:"mde-autosave-demo"}}},null,8,["modelValue"])]),_:1})]),s(n).includes("code2")?(l(),g(f,{key:0},{default:a(()=>e[9]||(e[9]=[t("pre",null,`  <!-- basic -->
  <vue-easymde v-model="content2" ref="editor2" :highlight="true" :configs="{ spellChecker: false, autosave: { enabled: true, delay: 1000, uniqueId: 'mde-autosave-demo' } }" />

  <!-- script -->
  <script lang="ts" setup>
    import { ref } from 'vue';
    const content2 = ref(\`
    # Autosaving!

    Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

    By default, it saves every 10 seconds, but this can be changed. When this textarea is included in a form, it will automatically forget the saved value when the form is submitted.
    \`);
  <\/script>
  `,-1)])),_:1,__:[9]})):v("",!0)])])])])}}});export{T as default};
