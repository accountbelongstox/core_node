const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./BHesoId7.js","./92s3wAHG.js"])))=>i.map(i=>d[i]);
import{d as x,u as L,r as f,o as M,af as V,h as H,k as o,q as p,c as w,s as u,v as l,B as b,J as y,i as e,b as c,g as d}from"./Cs8kveBG.js";import{c as B,h}from"./Bykx_eDL.js";import{S as Z}from"./BQIkj5Wb.js";import"./92s3wAHG.js";const $={class:"space-y-8 pt-5"},P={class:"grid grid-cols-1 gap-6 lg:grid-cols-2"},j={class:"panel"},T={class:"mb-5 flex items-center justify-between"},I={class:"mb-5"},O={class:"rounded bg-[#f1f2f3] p-5 dark:bg-[#060818]"},N={class:"mt-5 flex flex-wrap gap-2"},A={class:"panel"},D={class:"mb-5 flex items-center justify-between"},E={class:"mb-5"},S={class:"rounded bg-[#f1f2f3] p-5 dark:bg-[#060818]"},U={class:"mt-5 flex flex-wrap gap-2"},q={class:"panel"},F={class:"mb-5 flex items-center justify-between"},J={class:"mb-5"},R={class:"rounded bg-[#f1f2f3] p-5 dark:bg-[#060818]"},z={class:"mt-5 flex flex-wrap gap-2"},G={class:"panel"},K={class:"mb-5 flex items-center justify-between"},Q={class:"mb-5"},W={class:"rounded bg-[#f1f2f3] p-5 dark:bg-[#060818]"},X={class:"mt-5 flex flex-wrap gap-2"},r1=x({__name:"clipboard",setup(Y){L({title:"Clipboard"});const{codeArr:C,toggleCode:m}=B(),i=f("http://www.admin-dashboard.com"),a=f("Lorem ipsum dolor sit amet, consectetur adipiscing elit...");let g=f();M(async()=>{const r=await V(()=>import("./BHesoId7.js"),__vite__mapDeps([0,1]),import.meta.url);let{toClipboard:t}=r.default();g=t});const n=async r=>{r&&(await g(r),k("Copied successfully."))},v=async r=>{r&&(await g(r),k("Cut successfully."))},k=(r="",t="success")=>{Z.mixin({toast:!0,position:"top",showConfirmButton:!1,timer:3e3,customClass:{container:"toast"}}).fire({icon:t,title:r,padding:"10px 20px"})};return(r,t)=>(d(),H("div",null,[t[39]||(t[39]=o("ul",{class:"flex space-x-2 rtl:space-x-reverse"},[o("li",null,[o("a",{href:"javascript:;",class:"text-primary hover:underline"},"Forms")]),o("li",{class:"before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"},[o("span",null,"Clipboard")])],-1)),o("div",$,[t[38]||(t[38]=p('<div class="panel flex items-center overflow-x-auto whitespace-nowrap p-3 text-primary"><div class="rounded-full bg-primary p-1.5 text-white ring-2 ring-primary/30 ltr:mr-3 rtl:ml-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5"><path d="M19.0001 9.7041V9C19.0001 5.13401 15.8661 2 12.0001 2C8.13407 2 5.00006 5.13401 5.00006 9V9.7041C5.00006 10.5491 4.74995 11.3752 4.28123 12.0783L3.13263 13.8012C2.08349 15.3749 2.88442 17.5139 4.70913 18.0116C9.48258 19.3134 14.5175 19.3134 19.291 18.0116C21.1157 17.5139 21.9166 15.3749 20.8675 13.8012L19.7189 12.0783C19.2502 11.3752 19.0001 10.5491 19.0001 9.7041Z" stroke="currentColor" stroke-width="1.5"></path><path opacity="0.5" d="M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></div><span class="ltr:mr-3 rtl:ml-3">Documentation: </span><a href="https://www.npmjs.com/package/vue-clipboard3" target="_blank" class="block hover:underline">https://www.npmjs.com/package/vue-clipboard3</a></div>',1)),o("div",P,[o("div",j,[o("div",T,[t[16]||(t[16]=o("h5",{class:"text-lg font-semibold dark:text-white-light"},"Copy from input",-1)),o("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[0]||(t[0]=s=>l(m)("code1"))},t[15]||(t[15]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),o("div",I,[o("div",O,[o("form",null,[b(o("input",{type:"text",class:"form-input","onUpdate:modelValue":t[1]||(t[1]=s=>i.value=s),id:"message1"},null,512),[[y,i.value]]),o("div",N,[o("button",{type:"button",class:"btn btn-primary",onClick:t[2]||(t[2]=s=>n(i.value))},t[17]||(t[17]=[o("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 ltr:mr-2 rtl:ml-2"},[o("path",{d:"M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z",stroke:"currentColor","stroke-width":"1.5"}),o("path",{opacity:"0.5",d:"M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5",stroke:"currentColor","stroke-width":"1.5"})],-1),e(" Copy from Input ")])),o("button",{type:"button",class:"btn btn-dark",onClick:t[3]||(t[3]=s=>v(i.value)),onBlur:t[4]||(t[4]=s=>i.value="")},t[18]||(t[18]=[o("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-4.5 w-4.5 ltr:mr-2 rtl:ml-2"},[o("path",{d:"M15.2869 3.15178L14.3601 4.07866L5.83882 12.5999L5.83881 12.5999C5.26166 13.1771 4.97308 13.4656 4.7249 13.7838C4.43213 14.1592 4.18114 14.5653 3.97634 14.995C3.80273 15.3593 3.67368 15.7465 3.41556 16.5208L2.32181 19.8021L2.05445 20.6042C1.92743 20.9852 2.0266 21.4053 2.31063 21.6894C2.59466 21.9734 3.01478 22.0726 3.39584 21.9456L4.19792 21.6782L7.47918 20.5844L7.47919 20.5844C8.25353 20.3263 8.6407 20.1973 9.00498 20.0237C9.43469 19.8189 9.84082 19.5679 10.2162 19.2751C10.5344 19.0269 10.8229 18.7383 11.4001 18.1612L11.4001 18.1612L19.9213 9.63993L20.8482 8.71306C22.3839 7.17735 22.3839 4.68748 20.8482 3.15178C19.3125 1.61607 16.8226 1.61607 15.2869 3.15178Z",stroke:"currentColor","stroke-width":"1.5"}),o("path",{opacity:"0.5",d:"M14.36 4.07812C14.36 4.07812 14.4759 6.04774 16.2138 7.78564C17.9517 9.52354 19.9213 9.6394 19.9213 9.6394M4.19789 21.6777L2.32178 19.8015",stroke:"currentColor","stroke-width":"1.5"})],-1),e(" Cut from Input ")]),32)])])])]),l(C).includes("code1")?(d(),w(h,{key:0},{default:c(()=>t[19]||(t[19]=[o("pre",null,`<!-- copy from input -->
<form>
  <input type="text" class="form-input" v-model="message1" id="message1" />
  <div class="flex flex-wrap gap-2 mt-5">
    <button type="button" class="btn btn-primary" @click="copy(message1)">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ltr:mr-2 rtl:ml-2">
        <path
          d="M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          opacity="0.5"
          d="M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </svg>
      Copy from Input
    </button>
    <button type="button" class="btn btn-dark" @click="cut(message1)" @blur="message1 = ''">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 ltr:mr-2 rtl:ml-2">
        <path
          d="M15.2869 3.15178L14.3601 4.07866L5.83882 12.5999L5.83881 12.5999C5.26166 13.1771 4.97308 13.4656 4.7249 13.7838C4.43213 14.1592 4.18114 14.5653 3.97634 14.995C3.80273 15.3593 3.67368 15.7465 3.41556 16.5208L2.32181 19.8021L2.05445 20.6042C1.92743 20.9852 2.0266 21.4053 2.31063 21.6894C2.59466 21.9734 3.01478 22.0726 3.39584 21.9456L4.19792 21.6782L7.47918 20.5844L7.47919 20.5844C8.25353 20.3263 8.6407 20.1973 9.00498 20.0237C9.43469 19.8189 9.84082 19.5679 10.2162 19.2751C10.5344 19.0269 10.8229 18.7383 11.4001 18.1612L11.4001 18.1612L19.9213 9.63993L20.8482 8.71306C22.3839 7.17735 22.3839 4.68748 20.8482 3.15178C19.3125 1.61607 16.8226 1.61607 15.2869 3.15178Z"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          opacity="0.5"
          d="M14.36 4.07812C14.36 4.07812 14.4759 6.04774 16.2138 7.78564C17.9517 9.52354 19.9213 9.6394 19.9213 9.6394M4.19789 21.6777L2.32178 19.8015"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </svg>
      Cut from Input
    </button>
  </div>
</form>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
import useClipboard from 'vue-clipboard3';

const { toClipboard } = useClipboard();
const copy = async (msg) => {
  if (msg) {
    await toClipboard(msg);
    showMessage('Copied successfully.');
  }
};

const cut = async (msg) => {
  if (msg) {
    await toClipboard(msg);
    showMessage('Cut successfully.');
  }
};
<\/script>
`,-1)])),_:1,__:[19]})):u("",!0)]),o("div",A,[o("div",D,[t[21]||(t[21]=o("h5",{class:"text-lg font-semibold dark:text-white-light"},"Copy form Textarea",-1)),o("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[5]||(t[5]=s=>l(m)("code2"))},t[20]||(t[20]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),o("div",E,[o("div",S,[o("form",null,[b(o("textarea",{rows:"3",wrap:"soft",class:"form-textarea","onUpdate:modelValue":t[6]||(t[6]=s=>a.value=s),id:"message2"},null,512),[[y,a.value]]),o("div",U,[o("button",{type:"button",class:"btn btn-primary",onClick:t[7]||(t[7]=s=>n(a.value))},t[22]||(t[22]=[o("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 ltr:mr-2 rtl:ml-2"},[o("path",{d:"M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z",stroke:"currentColor","stroke-width":"1.5"}),o("path",{opacity:"0.5",d:"M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5",stroke:"currentColor","stroke-width":"1.5"})],-1),e(" Copy from Input ")])),o("button",{type:"button",class:"btn btn-dark",onClick:t[8]||(t[8]=s=>v(a.value)),onBlur:t[9]||(t[9]=s=>a.value="")},t[23]||(t[23]=[o("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-4.5 w-4.5 ltr:mr-2 rtl:ml-2"},[o("path",{d:"M15.2869 3.15178L14.3601 4.07866L5.83882 12.5999L5.83881 12.5999C5.26166 13.1771 4.97308 13.4656 4.7249 13.7838C4.43213 14.1592 4.18114 14.5653 3.97634 14.995C3.80273 15.3593 3.67368 15.7465 3.41556 16.5208L2.32181 19.8021L2.05445 20.6042C1.92743 20.9852 2.0266 21.4053 2.31063 21.6894C2.59466 21.9734 3.01478 22.0726 3.39584 21.9456L4.19792 21.6782L7.47918 20.5844L7.47919 20.5844C8.25353 20.3263 8.6407 20.1973 9.00498 20.0237C9.43469 19.8189 9.84082 19.5679 10.2162 19.2751C10.5344 19.0269 10.8229 18.7383 11.4001 18.1612L11.4001 18.1612L19.9213 9.63993L20.8482 8.71306C22.3839 7.17735 22.3839 4.68748 20.8482 3.15178C19.3125 1.61607 16.8226 1.61607 15.2869 3.15178Z",stroke:"currentColor","stroke-width":"1.5"}),o("path",{opacity:"0.5",d:"M14.36 4.07812C14.36 4.07812 14.4759 6.04774 16.2138 7.78564C17.9517 9.52354 19.9213 9.6394 19.9213 9.6394M4.19789 21.6777L2.32178 19.8015",stroke:"currentColor","stroke-width":"1.5"})],-1),e(" Cut from Input ")]),32)])])])]),l(C).includes("code2")?(d(),w(h,{key:0},{default:c(()=>t[24]||(t[24]=[o("pre",null,`<!-- copy from textare -->
<form>
  <textarea rows="3" wrap="soft" class="form-textarea" v-model="message2" id="message2"></textarea>
  <div class="flex flex-wrap gap-2 mt-5">
    <button type="button" class="btn btn-primary" @click="copy(message2)">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ltr:mr-2 rtl:ml-2">
        <path
          d="M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          opacity="0.5"
          d="M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </svg>
      Copy from Input
    </button>
    <button type="button" class="btn btn-dark" @click="cut(message2)" @blur="message2 = ''">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 ltr:mr-2 rtl:ml-2">
        <path
          d="M15.2869 3.15178L14.3601 4.07866L5.83882 12.5999L5.83881 12.5999C5.26166 13.1771 4.97308 13.4656 4.7249 13.7838C4.43213 14.1592 4.18114 14.5653 3.97634 14.995C3.80273 15.3593 3.67368 15.7465 3.41556 16.5208L2.32181 19.8021L2.05445 20.6042C1.92743 20.9852 2.0266 21.4053 2.31063 21.6894C2.59466 21.9734 3.01478 22.0726 3.39584 21.9456L4.19792 21.6782L7.47918 20.5844L7.47919 20.5844C8.25353 20.3263 8.6407 20.1973 9.00498 20.0237C9.43469 19.8189 9.84082 19.5679 10.2162 19.2751C10.5344 19.0269 10.8229 18.7383 11.4001 18.1612L11.4001 18.1612L19.9213 9.63993L20.8482 8.71306C22.3839 7.17735 22.3839 4.68748 20.8482 3.15178C19.3125 1.61607 16.8226 1.61607 15.2869 3.15178Z"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          opacity="0.5"
          d="M14.36 4.07812C14.36 4.07812 14.4759 6.04774 16.2138 7.78564C17.9517 9.52354 19.9213 9.6394 19.9213 9.6394M4.19789 21.6777L2.32178 19.8015"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </svg>
      Cut from Input
    </button>
  </div>
</form>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
import useClipboard from 'vue-clipboard3';

const { toClipboard } = useClipboard();
const copy = async (msg) => {
  if (msg) {
    await toClipboard(msg);
    showMessage('Copied successfully.');
  }
};

const cut = async (msg) => {
  if (msg) {
    await toClipboard(msg);
    showMessage('Cut successfully.');
  }
};
<\/script>
`,-1)])),_:1,__:[24]})):u("",!0)]),o("div",q,[o("div",F,[t[26]||(t[26]=o("h5",{class:"text-lg font-semibold dark:text-white-light"},"Copy Text from Paragraph",-1)),o("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[10]||(t[10]=s=>l(m)("code3"))},t[25]||(t[25]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),o("div",J,[o("div",R,[o("form",null,[t[28]||(t[28]=o("p",{class:"mb-3 font-semibold"},[e("Here is your OTP "),o("span",{class:"text-2xl",id:"copyOTP"},"22991"),e(".")],-1)),t[29]||(t[29]=o("p",{class:"font-semibold"},"Please do not share it to anyone",-1)),o("div",z,[o("button",{type:"button",class:"btn btn-primary",onClick:t[11]||(t[11]=s=>n("22991"))},t[27]||(t[27]=[o("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 ltr:mr-2 rtl:ml-2"},[o("path",{d:"M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z",stroke:"currentColor","stroke-width":"1.5"}),o("path",{opacity:"0.5",d:"M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5",stroke:"currentColor","stroke-width":"1.5"})],-1),e(" Copy from Paragraph ")]))])])])]),l(C).includes("code3")?(d(),w(h,{key:0},{default:c(()=>t[30]||(t[30]=[o("pre",null,`<!-- copy from paragraph -->
<form>
  <p class="mb-3 font-semibold">Here is your OTP <span class="text-2xl" id="copyOTP">22991</span>.</p>
  <p class="font-semibold">Please do not share it to anyone</p>
  <div class="flex flex-wrap gap-2 mt-5">
    <button type="button" class="btn btn-primary" @click="copy('22991')">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ltr:mr-2 rtl:ml-2">
        <path
          d="M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          opacity="0.5"
          d="M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </svg>
      Copy from Paragraph
    </button>
  </div>
</form>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
import useClipboard from 'vue-clipboard3';

const { toClipboard } = useClipboard();
const copy = async (msg) => {
  if (msg) {
    await toClipboard(msg);
    showMessage('Copied successfully.');
  }
};
<\/script>
`,-1)])),_:1,__:[30]})):u("",!0)]),o("div",G,[o("div",K,[t[32]||(t[32]=o("h5",{class:"text-lg font-semibold dark:text-white-light"},"Copy Hidden Text (Advanced)",-1)),o("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[12]||(t[12]=s=>l(m)("code4"))},t[31]||(t[31]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),o("div",Q,[o("div",W,[o("form",null,[t[35]||(t[35]=o("p",{class:"mb-3 font-semibold"},[o("span",null," Link -> "),e(),o("span",{id:"copyLink"}," http://www.admin-dashboard.com/code")],-1)),t[36]||(t[36]=o("span",{class:"absolute opacity-0",id:"copyHiddenCode"},"2291",-1)),o("div",X,[o("button",{type:"button",class:"btn btn-primary",onClick:t[13]||(t[13]=s=>n("http://www.admin-dashboard.com/code"))},t[33]||(t[33]=[o("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 ltr:mr-2 rtl:ml-2"},[o("path",{d:"M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z",stroke:"currentColor","stroke-width":"1.5"}),o("path",{opacity:"0.5",d:"M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5",stroke:"currentColor","stroke-width":"1.5"})],-1),e(" Copy Link ")])),o("button",{type:"button",class:"btn btn-dark",onClick:t[14]||(t[14]=s=>n("2291"))},t[34]||(t[34]=[o("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 ltr:mr-2 rtl:ml-2"},[o("path",{d:"M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z",stroke:"currentColor","stroke-width":"1.5"}),o("path",{opacity:"0.5",d:"M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5",stroke:"currentColor","stroke-width":"1.5"})],-1),e(" Copy Hidden Code ")]))])])])]),l(C).includes("code4")?(d(),w(h,{key:0},{default:c(()=>t[37]||(t[37]=[o("pre",null,`<!-- advanced -->
<form>
  <p class="mb-3 font-semibold"><span> Link -> </span> <span id="copyLink"> http://www.admin-dashboard.com/code</span></p>
  <span class="absolute opacity-0" id="copyHiddenCode">2291</span>
  <div class="flex flex-wrap gap-2 mt-5">
    <button type="button" class="btn btn-primary" @click="copy('http://www.admin-dashboard.com/code')">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ltr:mr-2 rtl:ml-2">
        <path
          d="M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          opacity="0.5"
          d="M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </svg>
      Copy Link
    </button>
    <button type="button" class="btn btn-dark" @click="copy('2291')">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ltr:mr-2 rtl:ml-2">
        <path
          d="M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          opacity="0.5"
          d="M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </svg>
      Copy Hidden Code
    </button>
  </div>
</form>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
import useClipboard from 'vue-clipboard3';
const message1 = ref('http://www.admin-dashboard.com');
const message2 = ref('Lorem ipsum dolor sit amet, consectetur adipiscing elit...');

const { toClipboard } = useClipboard();
const copy = async (msg) => {
  if (msg) {
    await toClipboard(msg);
    showMessage('Copied successfully.');
  }
};
<\/script>
`,-1)])),_:1,__:[37]})):u("",!0)])])])]))}});export{r1 as default};
