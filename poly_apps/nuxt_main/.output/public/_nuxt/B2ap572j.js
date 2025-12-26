import{d as k,u as C,r as w,p as _,h as p,k as e,c as m,s as h,v as r,q as i,B as L,J as j,F as B,A,b as g,z as d,t as f,g as l}from"./Cs8kveBG.js";import{c as M,h as v}from"./Bykx_eDL.js";import"./92s3wAHG.js";const S={class:"grid grid-cols-1 gap-6 pt-5 lg:grid-cols-2"},$={class:"panel lg:row-span-2"},q={class:"mb-5 flex items-center justify-between"},J={class:"mb-5 space-y-5"},N={class:"mx-auto mb-5 w-full sm:w-1/2"},V={class:"relative"},P={class:"block w-full space-y-4 overflow-x-auto rounded-lg border border-white-dark/20 p-4"},R={class:"user-profile"},z=["src"],D={class:"panel"},E={class:"mb-5 flex items-center justify-between"},F={class:"mb-5 space-y-5"},G={class:"panel"},K={class:"mb-5 flex items-center justify-between"},I=k({__name:"search",setup(H){C({title:"Search"});const{codeArr:u,toggleCode:c}=M(),o=w(""),b=[{thumb:"profile-5.jpeg",name:"Alan Green",email:"alan@mail.com",status:"Active",statusClass:"badge badge-outline-primary"},{thumb:"profile-11.jpeg",name:"Linda Nelson",email:"Linda@mail.com",status:"Busy",statusClass:"badge badge-outline-danger"},{thumb:"profile-12.jpeg",name:"Lila Perry",email:"Lila@mail.com",status:"Closed",statusClass:"badge badge-outline-warning"},{thumb:"profile-3.jpeg",name:"Andy King",email:"Andy@mail.com",status:"Active",statusClass:"badge badge-outline-primary"},{thumb:"profile-15.jpeg",name:"Jesse Cory",email:"Jesse@mail.com",status:"Busy",statusClass:"badge badge-outline-danger"}],a=w(!1),y=_(()=>b.filter(n=>n.name.toLowerCase().includes(o.value.toLowerCase())||n.email.toLowerCase().includes(o.value.toLowerCase())||n.status.toLowerCase().includes(o.value.toLowerCase())));return(n,t)=>(l(),p("div",null,[t[19]||(t[19]=e("ul",{class:"flex space-x-2 rtl:space-x-reverse"},[e("li",null,[e("a",{href:"javascript:;",class:"text-primary hover:underline"},"Elements")]),e("li",{class:"before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"},[e("span",null,"Search")])],-1)),e("div",S,[e("div",$,[e("div",q,[t[7]||(t[7]=e("h5",{class:"text-lg font-semibold dark:text-white-light"},"Live Search",-1)),e("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[0]||(t[0]=s=>r(c)("code1"))},t[6]||(t[6]=[i('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e("div",J,[e("div",null,[e("form",N,[e("div",V,[L(e("input",{type:"text",placeholder:"Search Attendees...",class:"form-input h-11 rounded-full bg-white shadow-[0_0_4px_2px_rgb(31_45_61_/_10%)] placeholder:tracking-wider ltr:pr-11 rtl:pl-11","onUpdate:modelValue":t[1]||(t[1]=s=>o.value=s)},null,512),[[j,o.value]]),t[8]||(t[8]=e("button",{type:"button",class:"btn btn-primary absolute inset-y-0 m-auto flex h-9 w-9 items-center justify-center rounded-full p-0 ltr:right-1 rtl:left-1"},[e("svg",{class:"mx-auto",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg"},[e("circle",{cx:"11.5",cy:"11.5",r:"9.5",stroke:"currentColor","stroke-width":"1.5",opacity:"0.5"}),e("path",{d:"M18.5 18.5L22 22",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"})])],-1))])]),e("div",P,[(l(!0),p(B,null,A(y.value,(s,x)=>(l(),p("div",{key:x,class:"flex min-w-[625px] items-center justify-between rounded-xl bg-white p-3 font-semibold text-gray-500 shadow-[0_0_4px_2px_rgb(31_45_61_/_10%)] transition-all duration-300 hover:scale-[1.01] hover:text-primary dark:bg-[#1b2e4b]"},[e("div",R,[e("img",{src:`/assets/images/${s.thumb}`,alt:"",class:"h-8 w-8 rounded-md object-cover"},null,8,z)]),e("div",null,f(s.name),1),e("div",null,f(s.email),1),e("div",{class:d(["badge border-2 border-dashed",s.statusClass])},f(s.status),3),t[9]||(t[9]=i('<div class="cursor-pointer"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 opacity-70"><circle cx="5" cy="12" r="2" stroke="currentColor" stroke-width="1.5"></circle><circle opacity="0.5" cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"></circle><circle cx="19" cy="12" r="2" stroke="currentColor" stroke-width="1.5"></circle></svg></div>',1))]))),128))])])]),r(u).includes("code1")?(l(),m(v,{key:0},{default:g(()=>t[10]||(t[10]=[e("pre",null,`<!-- live search -->
<div>
  <!-- searchbar -->
  <form class="mx-auto w-full sm:w-1/2 mb-5">
    <div class="relative">
      <input
        type="text"
        placeholder="Search Attendees..."
        class="form-input shadow-[0_0_4px_2px_rgb(31_45_61_/_10%)] bg-white rounded-full h-11 placeholder:tracking-wider ltr:pr-11 rtl:pl-11"
        v-model="search"
      />
      <button type="button" class="btn btn-primary absolute ltr:right-1 rtl:left-1 inset-y-0 m-auto rounded-full w-9 h-9 p-0 flex items-center justify-center">
        <svg> ... </svg>
      </button>
    </div>
  </form>

  <!-- result -->
  <div class="p-4 border border-white-dark/20 rounded-lg space-y-4 overflow-x-auto w-full block">
    <template v-for="(item, i) in searchResults" :key="i">
      <div
        class="
          bg-white
          dark:bg-[#1b2e4b]
          rounded-xl
          shadow-[0_0_4px_2px_rgb(31_45_61_/_10%)]
          p-3
          flex
          items-center
          justify-between
          text-gray-500
          font-semibold
          min-w-[625px]
          hover:text-primary
          transition-all
          duration-300
          hover:scale-[1.01]
        "
      >
        <div class="user-profile">
          <img :src="\`/assets/images/\${item.thumb}\`" alt="" class="w-8 h-8 rounded-md object-cover" />
        </div>
        <div>{{ item.name }}</div>
        <div>{{ item.email }}</div>
        <div class="badge border-2 border-dashed" :class="item.statusClass">
          {{ item.status }}
        </div>
        <div class="cursor-pointer">
          <svg> ... </svg>
        </div>
      </div>
    </template>
  </div>
</div>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
const search = ref('');
const items: any = [
  {
    thumb: 'profile-5.jpeg',
    name: 'Alan Green',
    email: 'alan@mail.com',
    status: 'Active',
    statusClass: 'badge badge-outline-primary',
  },
  {
    thumb: 'profile-11.jpeg',
    name: 'Linda Nelson',
    email: 'Linda@mail.com',
    status: 'Busy',
    statusClass: 'badge badge-outline-danger',
  },
  {
    thumb: 'profile-12.jpeg',
    name: 'Lila Perry',
    email: 'Lila@mail.com',
    status: 'Closed',
    statusClass: 'badge badge-outline-warning',
  },
  {
    thumb: 'profile-3.jpeg',
    name: 'Andy King',
    email: 'Andy@mail.com',
    status: 'Active',
    statusClass: 'badge badge-outline-primary',
  },
  {
    thumb: 'profile-15.jpeg',
    name: 'Jesse Cory',
    email: 'Jesse@mail.com',
    status: 'Busy',
    statusClass: 'badge badge-outline-danger',
  },
];
const searchResults = computed(() => {
  return items.filter((item: any) => {
    return (
      item.name.toLowerCase().includes(search.value.toLowerCase()) || item.email.toLowerCase().includes(search.value.toLowerCase()) || item.status.toLowerCase().includes(search.value.toLowerCase())
    );
  });
});
<\/script>
`,-1)])),_:1,__:[10]})):h("",!0)]),e("div",D,[e("div",E,[t[12]||(t[12]=e("h5",{class:"text-lg font-semibold dark:text-white-light"},"Overlay",-1)),e("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[2]||(t[2]=s=>r(c)("code2"))},t[11]||(t[11]=[i('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e("div",F,[e("form",null,[e("div",{class:d(["search-form-overlay relative h-12 w-full rounded-md border border-white-dark/20",a.value&&"input-focused"]),onClick:t[4]||(t[4]=s=>a.value=!0)},[e("input",{type:"text",placeholder:"Search...",class:d(["peer form-input hidden h-full bg-white placeholder:tracking-wider ltr:pl-12 rtl:pr-12",{"!block":a.value}]),onBlur:t[3]||(t[3]=s=>a.value=!1)},null,34),e("button",{type:"submit",class:d(["absolute inset-y-0 my-auto flex h-9 w-9 items-center justify-center p-0 text-dark/70 peer-focus:text-primary ltr:right-1 rtl:left-1",{"ltr:!right-auto ltr:left-1 rtl:right-1":a.value}])},t[13]||(t[13]=[e("svg",{class:"mx-auto",width:"20",height:"20",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg"},[e("circle",{cx:"11.5",cy:"11.5",r:"9.5",stroke:"currentColor","stroke-width":"1.5",opacity:"0.5"}),e("path",{d:"M18.5 18.5L22 22",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"})],-1)]),2)],2)])]),r(u).includes("code2")?(l(),m(v,{key:0},{default:g(()=>t[14]||(t[14]=[e("pre",null,`<!-- overlay -->
<form>
  <div class="search-form-overlay relative border border-white-dark/20 rounded-md h-12 w-full" @click="focus = true" :class="focus && 'input-focused'">
    <input
      type="text"
      placeholder="Search..."
      class="form-input bg-white h-full placeholder:tracking-wider hidden ltr:pl-12 rtl:pr-12 peer"
      :class="{ '!block': focus }"
      @blur="focus = false"
    />
    <button
      type="submit"
      class="text-dark/70 absolute ltr:right-1 rtl:left-1 inset-y-0 my-auto w-9 h-9 p-0 flex items-center justify-center peer-focus:text-primary"
      :class="{ 'ltr:!right-auto ltr:left-1 rtl:right-1': focus }"
    >
      <svg> ... </svg>
    </button>
  </div>
</form>

<!-- script -->
<script lang="ts" setup>
  import { ref } from 'vue';
  const focus = ref(false);
<\/script>
`,-1)])),_:1,__:[14]})):h("",!0)]),e("div",G,[e("div",K,[t[16]||(t[16]=e("h5",{class:"text-lg font-semibold dark:text-white-light"},"Search Box",-1)),e("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[5]||(t[5]=s=>r(c)("code3"))},t[15]||(t[15]=[i('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t[18]||(t[18]=i('<div class="mb-5 space-y-5"><form><div class="relative flex w-full border border-white-dark/20"><button type="submit" placeholder="Let&#39;s find your question in fast way" class="m-auto flex items-center justify-center p-3 text-primary"><svg class="mx-auto" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11.5" cy="11.5" r="9.5" stroke="currentColor" stroke-width="1.5" opacity="0.5"></circle><path d="M18.5 18.5L22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></button><input type="text" placeholder="Let&#39;s find your question in fast way" class="form-input rounded-none border-0 border-l bg-white py-3 placeholder:tracking-wider focus:shadow-[0_0_5px_2px_rgb(194_213_255_/_62%)] focus:outline-none dark:shadow-[#1b2e4b]"></div></form></div>',1)),r(u).includes("code3")?(l(),m(v,{key:0},{default:g(()=>t[17]||(t[17]=[e("pre",null,`<!-- boxed -->
<form>
    <div class="relative border border-white-dark/20  w-full flex">
        <button type="submit" placeholder="Let's find your question in fast way" class="text-primary m-auto p-3 flex items-center justify-center">
          <svg> ... </svg>
        </button>
        <input type="text" placeholder="Let's find your question in fast way" class="form-input border-0 border-l rounded-none bg-white  focus:shadow-[0_0_5px_2px_rgb(194_213_255_/_62%)] dark:shadow-[#1b2e4b] placeholder:tracking-wider focus:outline-none py-3" />
    </div>
</form>
`,-1)])),_:1,__:[17]})):h("",!0)])])]))}});export{I as default};
