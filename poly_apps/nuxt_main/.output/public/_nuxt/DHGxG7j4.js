import{d as j,u as P,r as S,h as l,k as t,c as C,s as w,v as d,q as h,F as f,A as y,b as r,t as a,z as x,l as n,B as u,y as L,i as g,x as N,n as B,C as A,g as o}from"./Cs8kveBG.js";import{c as H,h as k}from"./Bykx_eDL.js";import{u as E}from"./CPc_GOQr.js";import"./92s3wAHG.js";const I={class:"grid grid-cols-1 gap-6 xl:grid-cols-2"},$={class:"panel"},J={class:"mb-5 flex items-center justify-between"},z={class:"mb-5"},T={class:"table-responsive"},V={class:"whitespace-nowrap"},F={class:"text-center"},O={type:"button"},Z={class:"panel"},K={class:"mb-5 flex items-center justify-between"},R={class:"mb-5"},q={class:"table-responsive"},Y={class:"table-hover"},G={class:"whitespace-nowrap"},Q={class:"text-center"},U={type:"button"},W={class:"panel"},X={class:"mb-5 flex items-center justify-between"},tt={class:"mb-5"},et={class:"table-responsive"},st={class:"table-striped"},ot={class:"whitespace-nowrap"},rt={class:"text-center"},at={type:"button"},lt={class:"panel"},nt={class:"mb-5 flex items-center justify-between"},dt={class:"mb-5"},it={class:"table-responsive"},pt={class:"table-hover"},ct={class:"whitespace-nowrap"},ht={class:"text-center"},ut={type:"button"},gt={class:"panel"},mt={class:"mb-5 flex items-center justify-between"},vt={class:"mb-5"},Ct={class:"table-responsive"},wt={class:"whitespace-nowrap"},kt={class:"text-center"},bt={class:"panel"},ft={class:"mb-5 flex items-center justify-between"},yt={class:"mb-5"},xt={class:"table-responsive"},Lt={class:"whitespace-nowrap"},_t={class:"flex h-1.5 w-full rounded-full bg-[#ebedf2] dark:bg-dark/40"},Dt={class:"border-b border-[#ebedf2] p-3 text-center dark:border-[#191e3a]"},Mt={class:"flex items-center"},jt={type:"button"},Pt={type:"button"},St={class:"panel"},Nt={class:"mb-5 flex items-center justify-between"},Bt={class:"panel"},At={class:"mb-5 flex items-center justify-between"},Ht={class:"mb-5"},Et={class:"table-responsive"},It={class:"whitespace-nowrap"},$t={class:"text-center"},Jt={class:"dropdown"},zt=["onClick"],Tt={class:"panel"},Vt={class:"mb-5 flex items-center justify-between"},Ft={class:"mb-5"},Ot={class:"table-responsive"},Zt={class:"whitespace-nowrap"},Kt={class:"text-center"},Rt={class:"flex items-center justify-center gap-2"},qt={href:"javascript:;"},Yt={href:"javascript:;"},Gt={class:"panel"},Qt={class:"mb-5 flex items-center justify-between"},Ut={class:"mb-5"},Wt={class:"table-responsive"},Xt={class:"whitespace-nowrap"},te={class:"text-center"},ee={class:"flex items-center justify-center gap-2"},se={href:"javascript:;"},oe={href:"javascript:;"},re={href:"javascript:;"},he=j({__name:"tables",setup(ae){P({title:"Tables"});const _=E(),{codeArr:m,toggleCode:v}=H(),b=S([{id:1,name:"John Doe",email:"johndoe@yahoo.com",date:"10/08/2020",sale:120,status:"Complete",register:"5 min ago",progress:"40%",position:"Developer",office:"London"},{id:2,name:"Shaun Park",email:"shaunpark@gmail.com",date:"11/08/2020",sale:400,status:"Pending",register:"11 min ago",progress:"23%",position:"Designer",office:"New York"},{id:3,name:"Alma Clarke",email:"alma@gmail.com",date:"12/02/2020",sale:310,status:"In Progress",register:"1 hour ago",progress:"80%",position:"Accountant",office:"Amazon"},{id:4,name:"Vincent Carpenter",email:"vincent@gmail.com",date:"13/08/2020",sale:100,status:"Canceled",register:"1 day ago",progress:"60%",position:"Data Scientist",office:"Canada"}]);return(le,e)=>{const p=L("tippy"),i=N,D=L("Popper"),c=A("tippy");return o(),l("div",null,[t("div",I,[t("div",$,[t("div",J,[e[11]||(e[11]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Simple Table",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[0]||(e[0]=s=>d(v)("code1"))},e[10]||(e[10]=[h('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",z,[t("div",T,[t("table",null,[e[14]||(e[14]=t("thead",null,[t("tr",null,[t("th",null,"Name"),t("th",null,"Date"),t("th",null,"Sale"),t("th",{class:"text-center"},"Status"),t("th",{class:"text-center"},"Action")])],-1)),t("tbody",null,[(o(!0),l(f,null,y(b.value,s=>(o(),l("tr",{key:s.id},[t("td",V,a(s.name),1),t("td",null,a(s.date),1),t("td",null,a(s.sale),1),t("td",{class:x(["whitespace-nowrap text-center",{"text-success":s.status==="Complete","text-secondary":s.status==="Pending","text-info":s.status==="In Progress","text-danger":s.status==="Canceled"}])},a(s.status),3),t("td",F,[n(i,null,{default:r(()=>[u((o(),l("button",O,e[12]||(e[12]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"m-auto h-5 w-5"},[t("path",{d:"M20.5001 6H3.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{d:"M18.8334 8.5L18.3735 15.3991C18.1965 18.054 18.108 19.3815 17.243 20.1907C16.378 21 15.0476 21 12.3868 21H11.6134C8.9526 21 7.6222 21 6.75719 20.1907C5.89218 19.3815 5.80368 18.054 5.62669 15.3991L5.16675 8.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M9.5 11L10 16",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M14.5 11L14 16",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M6.5 6C6.55588 6 6.58382 6 6.60915 5.99936C7.43259 5.97849 8.15902 5.45491 8.43922 4.68032C8.44784 4.65649 8.45667 4.62999 8.47434 4.57697L8.57143 4.28571C8.65431 4.03708 8.69575 3.91276 8.75071 3.8072C8.97001 3.38607 9.37574 3.09364 9.84461 3.01877C9.96213 3 10.0932 3 10.3553 3H13.6447C13.9068 3 14.0379 3 14.1554 3.01877C14.6243 3.09364 15.03 3.38607 15.2493 3.8072C15.3043 3.91276 15.3457 4.03708 15.4286 4.28571L15.5257 4.57697C15.5433 4.62992 15.5522 4.65651 15.5608 4.68032C15.841 5.45491 16.5674 5.97849 17.3909 5.99936C17.4162 6 17.4441 6 17.5 6",stroke:"currentColor","stroke-width":"1.5"})],-1)]))),[[c,void 0,"delete"]]),n(p,{target:"delete"},{default:r(()=>e[13]||(e[13]=[g("Delete")])),_:1,__:[13]})]),_:1})])]))),128))])])])]),d(m).includes("code1")?(o(),C(k,{key:0},{default:r(()=>e[15]||(e[15]=[t("pre",null,`<!-- basic table -->
<div class="table-responsive">
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Date</th>
        <th>Sale</th>
        <th class="text-center">Status</th>
        <th class="text-center">Action</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="data in tableData" :key="data.id">
        <tr>
          <td class="whitespace-nowrap">{{ data.name }}</td>
          <td>{{ data.date }}</td>
          <td>{{ data.sale }}</td>
          <td
            class="text-center whitespace-nowrap"
            :class="{
              'text-success': data.status === 'Complete',
              'text-secondary': data.status === 'Pending',
              'text-info': data.status === 'In Progress',
              'text-danger': data.status === 'Canceled',
            }"
          >
            {{ data.status }}
          </td>
          <td class="text-center">
            <button type="button" v-tippy:delete>
              <svg> ... </svg>
            </button>
            <tippy target="delete">Delete</tippy>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</div>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
const tableData = ref([
  {
    id: 1,
    name: 'John Doe',
    email: 'johndoe@yahoo.com',
    date: '10/08/2020',
    sale: 120,
    status: 'Complete',
    register: '5 min ago',
    progress: '40%',
    position: 'Developer',
    office: 'London',
  },
  .....
]);
<\/script>
`,-1)])),_:1,__:[15]})):w("",!0)]),t("div",Z,[t("div",K,[e[17]||(e[17]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Hover Table",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[1]||(e[1]=s=>d(v)("code2"))},e[16]||(e[16]=[h('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code</span>',1)]))]),t("div",R,[t("div",q,[t("table",Y,[e[20]||(e[20]=t("thead",null,[t("tr",null,[t("th",null,"Name"),t("th",null,"Date"),t("th",null,"Sale"),t("th",{class:"text-center"},"Status"),t("th",{class:"text-center"},"Action")])],-1)),t("tbody",null,[(o(!0),l(f,null,y(b.value,s=>(o(),l("tr",{key:s.id},[t("td",G,a(s.name),1),t("td",null,a(s.date),1),t("td",null,a(s.sale),1),t("td",{class:x(["whitespace-nowrap text-center",{"text-success":s.status==="Complete","text-secondary":s.status==="Pending","text-info":s.status==="In Progress","text-danger":s.status==="Canceled"}])},a(s.status),3),t("td",Q,[n(i,null,{default:r(()=>[u((o(),l("button",U,e[18]||(e[18]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"m-auto h-5 w-5"},[t("path",{d:"M20.5001 6H3.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{d:"M18.8334 8.5L18.3735 15.3991C18.1965 18.054 18.108 19.3815 17.243 20.1907C16.378 21 15.0476 21 12.3868 21H11.6134C8.9526 21 7.6222 21 6.75719 20.1907C5.89218 19.3815 5.80368 18.054 5.62669 15.3991L5.16675 8.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M9.5 11L10 16",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M14.5 11L14 16",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M6.5 6C6.55588 6 6.58382 6 6.60915 5.99936C7.43259 5.97849 8.15902 5.45491 8.43922 4.68032C8.44784 4.65649 8.45667 4.62999 8.47434 4.57697L8.57143 4.28571C8.65431 4.03708 8.69575 3.91276 8.75071 3.8072C8.97001 3.38607 9.37574 3.09364 9.84461 3.01877C9.96213 3 10.0932 3 10.3553 3H13.6447C13.9068 3 14.0379 3 14.1554 3.01877C14.6243 3.09364 15.03 3.38607 15.2493 3.8072C15.3043 3.91276 15.3457 4.03708 15.4286 4.28571L15.5257 4.57697C15.5433 4.62992 15.5522 4.65651 15.5608 4.68032C15.841 5.45491 16.5674 5.97849 17.3909 5.99936C17.4162 6 17.4441 6 17.5 6",stroke:"currentColor","stroke-width":"1.5"})],-1)]))),[[c,void 0,"delete"]]),n(p,{target:"delete"},{default:r(()=>e[19]||(e[19]=[g("Delete")])),_:1,__:[19]})]),_:1})])]))),128))])])])]),d(m).includes("code2")?(o(),C(k,{key:0},{default:r(()=>e[21]||(e[21]=[t("pre",null,`<!-- hover table -->
<div class="table-responsive">
  <table class="table-hover">
    <thead>
      <tr>
        <th>Name</th>
        <th>Date</th>
        <th>Sale</th>
        <th class="text-center">Status</th>
        <th class="text-center">Action</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="data in tableData" :key="data.id">
        <tr>
          <td class="whitespace-nowrap">{{ data.name }}</td>
          <td>{{ data.date }}</td>
          <td>{{ data.sale }}</td>
          <td
            class="text-center whitespace-nowrap"
            :class="{
              'text-success': data.status === 'Complete',
              'text-secondary': data.status === 'Pending',
              'text-info': data.status === 'In Progress',
              'text-danger': data.status === 'Canceled',
            }"
          >
            {{ data.status }}
          </td>
          <td class="text-center">
            <button type="button" v-tippy:delete>
              <svg> ... </svg>
            </button>
            <tippy target="delete">Delete</tippy>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</div>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
const tableData = ref([
  {
    id: 1,
    name: 'John Doe',
    email: 'johndoe@yahoo.com',
    date: '10/08/2020',
    sale: 120,
    status: 'Complete',
    register: '5 min ago',
    progress: '40%',
    position: 'Developer',
    office: 'London',
  },
  .....
]);
<\/script>
`,-1)])),_:1,__:[21]})):w("",!0)]),t("div",W,[t("div",X,[e[23]||(e[23]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Striped Table",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[2]||(e[2]=s=>d(v)("code3"))},e[22]||(e[22]=[h('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code</span>',1)]))]),t("div",tt,[t("div",et,[t("table",st,[e[26]||(e[26]=t("thead",null,[t("tr",null,[t("th",null,"Name"),t("th",null,"Date"),t("th",null,"Sale"),t("th")])],-1)),t("tbody",null,[(o(!0),l(f,null,y(b.value,s=>(o(),l("tr",{key:s.id},[t("td",ot,a(s.name),1),t("td",null,a(s.date),1),t("td",null,a(s.sale),1),t("td",rt,[n(i,null,{default:r(()=>[u((o(),l("button",at,e[24]||(e[24]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"m-auto h-5 w-5"},[t("path",{d:"M20.5001 6H3.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{d:"M18.8334 8.5L18.3735 15.3991C18.1965 18.054 18.108 19.3815 17.243 20.1907C16.378 21 15.0476 21 12.3868 21H11.6134C8.9526 21 7.6222 21 6.75719 20.1907C5.89218 19.3815 5.80368 18.054 5.62669 15.3991L5.16675 8.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M9.5 11L10 16",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M14.5 11L14 16",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M6.5 6C6.55588 6 6.58382 6 6.60915 5.99936C7.43259 5.97849 8.15902 5.45491 8.43922 4.68032C8.44784 4.65649 8.45667 4.62999 8.47434 4.57697L8.57143 4.28571C8.65431 4.03708 8.69575 3.91276 8.75071 3.8072C8.97001 3.38607 9.37574 3.09364 9.84461 3.01877C9.96213 3 10.0932 3 10.3553 3H13.6447C13.9068 3 14.0379 3 14.1554 3.01877C14.6243 3.09364 15.03 3.38607 15.2493 3.8072C15.3043 3.91276 15.3457 4.03708 15.4286 4.28571L15.5257 4.57697C15.5433 4.62992 15.5522 4.65651 15.5608 4.68032C15.841 5.45491 16.5674 5.97849 17.3909 5.99936C17.4162 6 17.4441 6 17.5 6",stroke:"currentColor","stroke-width":"1.5"})],-1)]))),[[c,void 0,"delete"]]),n(p,{target:"delete"},{default:r(()=>e[25]||(e[25]=[g("Delete")])),_:1,__:[25]})]),_:1})])]))),128))])])])]),d(m).includes("code3")?(o(),C(k,{key:0},{default:r(()=>e[27]||(e[27]=[t("pre",null,`<!-- striped table -->
<div class="table-responsive">
  <table class="table-striped">
    <thead>
      <tr>
        <th>Name</th>
        <th>Date</th>
        <th>Sale</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <template v-for="data in tableData" :key="data.id">
        <tr>
          <td class="whitespace-nowrap">{{ data.name }}</td>
          <td>{{ data.date }}</td>
          <td>{{ data.sale }}</td>
          <td class="text-center">
            <button type="button" v-tippy:delete>
              <svg> ... </svg>
            </button>
            <tippy target="delete">Delete</tippy>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</div>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
const tableData = ref([
  {
    id: 1,
    name: 'John Doe',
    email: 'johndoe@yahoo.com',
    date: '10/08/2020',
    sale: 120,
    status: 'Complete',
    register: '5 min ago',
    progress: '40%',
    position: 'Developer',
    office: 'London',
  },
  .....
]);
<\/script>
`,-1)])),_:1,__:[27]})):w("",!0)]),t("div",lt,[t("div",nt,[e[29]||(e[29]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Table Light",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[3]||(e[3]=s=>d(v)("code4"))},e[28]||(e[28]=[h('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code</span>',1)]))]),t("div",dt,[t("div",it,[t("table",pt,[e[32]||(e[32]=t("thead",null,[t("tr",{class:"!bg-transparent dark:!bg-transparent"},[t("th",null,"#"),t("th",null,"Name"),t("th",null,"Email"),t("th",null,"Created At"),t("th",{class:"text-center"})])],-1)),t("tbody",null,[(o(!0),l(f,null,y(b.value,s=>(o(),l("tr",{key:s.id},[t("td",null,a(s.id),1),t("td",ct,a(s.name),1),t("td",null,a(s.email),1),t("td",null,a(s.date),1),t("td",ht,[n(i,null,{default:r(()=>[u((o(),l("button",ut,e[30]||(e[30]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"m-auto h-5 w-5"},[t("circle",{opacity:"0.5",cx:"12",cy:"12",r:"10",stroke:"currentColor","stroke-width":"1.5"}),t("path",{d:"M14.5 9.50002L9.5 14.5M9.49998 9.5L14.5 14.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"})],-1)]))),[[c,void 0,"delete"]]),n(p,{target:"delete"},{default:r(()=>e[31]||(e[31]=[g("Delete")])),_:1,__:[31]})]),_:1})])]))),128))])])])]),d(m).includes("code4")?(o(),C(k,{key:0},{default:r(()=>e[33]||(e[33]=[t("pre",null,`<!-- table light -->
<div class="table-responsive">
  <table class="table-hover">
    <thead>
      <tr class="!bg-transparent dark:!bg-transparent">
        <th>#</th>
        <th>Name</th>
        <th>Email</th>
        <th>Created At</th>
        <th class="text-center"></th>
      </tr>
    </thead>
    <tbody>
      <template v-for="data in tableData" :key="data.id">
        <tr>
          <td>{{ data.id }}</td>
          <td class="whitespace-nowrap">{{ data.name }}</td>
          <td>{{ data.email }}</td>
          <td>{{ data.date }}</td>
          <td class="text-center">
            <button type="button" v-tippy:delete>
              <svg> ... </svg>
            </button>
            <tippy target="delete">Delete</tippy>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</div>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
const tableData = ref([
  {
    id: 1,
    name: 'John Doe',
    email: 'johndoe@yahoo.com',
    date: '10/08/2020',
    sale: 120,
    status: 'Complete',
    register: '5 min ago',
    progress: '40%',
    position: 'Developer',
    office: 'London',
  },
  .....
]);
<\/script>
`,-1)])),_:1,__:[33]})):w("",!0)]),t("div",gt,[t("div",mt,[e[35]||(e[35]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Captions",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[4]||(e[4]=s=>d(v)("code5"))},e[34]||(e[34]=[h('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code</span>',1)]))]),t("div",vt,[t("div",Ct,[t("table",null,[e[36]||(e[36]=t("thead",null,[t("tr",null,[t("th",null,"#"),t("th",null,"Name"),t("th",null,"Email"),t("th",null,"Status"),t("th",{class:"text-center"},"Register")])],-1)),t("tbody",null,[(o(!0),l(f,null,y(b.value,s=>(o(),l("tr",{key:s.id},[t("td",null,a(s.id),1),t("td",wt,a(s.name),1),t("td",null,a(s.email),1),t("td",null,[t("span",{class:x(["badge whitespace-nowrap",{"badge-outline-primary":s.status==="Complete","badge-outline-secondary":s.status==="Pending","badge-outline-info":s.status==="In Progress","badge-outline-danger":s.status==="Canceled"}])},a(s.status),3)]),t("td",kt,a(s.register),1)]))),128))])])])]),d(m).includes("code5")?(o(),C(k,{key:0},{default:r(()=>e[37]||(e[37]=[t("pre",null,`<!-- caption -->
<div class="table-responsive">
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Name</th>
        <th>Email</th>
        <th>Status</th>
        <th class="text-center">Register</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="data in tableData" :key="data.id">
        <tr>
          <td>{{ data.id }}</td>
          <td class="whitespace-nowrap">{{ data.name }}</td>
          <td>{{ data.email }}</td>
          <td>
            <span
              class="badge whitespace-nowrap"
              :class="{
                'badge-outline-primary': data.status === 'Complete',
                'badge-outline-secondary': data.status === 'Pending',
                'badge-outline-info': data.status === 'In Progress',
                'badge-outline-danger': data.status === 'Canceled',
              }"
              >{{ data.status }}</span
            >
          </td>
          <td class="text-center">{{ data.register }}</td>
        </tr>
      </template>
    </tbody>
  </table>
</div>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
const tableData = ref([
  {
    id: 1,
    name: 'John Doe',
    email: 'johndoe@yahoo.com',
    date: '10/08/2020',
    sale: 120,
    status: 'Complete',
    register: '5 min ago',
    progress: '40%',
    position: 'Developer',
    office: 'London',
  },
  .....
]);
<\/script>
`,-1)])),_:1,__:[37]})):w("",!0)]),t("div",bt,[t("div",ft,[e[39]||(e[39]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Progress Table",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[5]||(e[5]=s=>d(v)("code6"))},e[38]||(e[38]=[h('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code</span>',1)]))]),t("div",yt,[t("div",xt,[t("table",null,[e[44]||(e[44]=t("thead",null,[t("tr",null,[t("th",null,"#"),t("th",null,"Name"),t("th",null,"Progress"),t("th",null,"Sales"),t("th",{class:"text-center"},"Action")])],-1)),t("tbody",null,[(o(!0),l(f,null,y(b.value,s=>(o(),l("tr",{key:s.id},[t("td",null,a(s.id),1),t("td",Lt,a(s.name),1),t("td",null,[t("div",_t,[t("div",{class:x(["h-1.5 rounded-full rounded-bl-full text-center text-xs text-white",{"bg-success":s.status==="Complete","bg-secondary":s.status==="Pending","bg-info":s.status==="In Progress","bg-danger":s.status==="Canceled"}]),style:B(`width: ${s.progress}`)},null,6)])]),t("td",{class:x(["whitespace-nowrap",{"text-success":s.status==="Complete","text-secondary":s.status==="Pending","text-info":s.status==="In Progress","text-danger":s.status==="Canceled"}])},a(s.progress),3),t("td",Dt,[t("div",Mt,[t("div",null,[n(i,null,{default:r(()=>[u((o(),l("button",jt,e[40]||(e[40]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-4.5 w-4.5 ltr:mr-2 rtl:ml-2"},[t("path",{d:"M15.2869 3.15178L14.3601 4.07866L5.83882 12.5999L5.83881 12.5999C5.26166 13.1771 4.97308 13.4656 4.7249 13.7838C4.43213 14.1592 4.18114 14.5653 3.97634 14.995C3.80273 15.3593 3.67368 15.7465 3.41556 16.5208L2.32181 19.8021L2.05445 20.6042C1.92743 20.9852 2.0266 21.4053 2.31063 21.6894C2.59466 21.9734 3.01478 22.0726 3.39584 21.9456L4.19792 21.6782L7.47918 20.5844L7.47919 20.5844C8.25353 20.3263 8.6407 20.1973 9.00498 20.0237C9.43469 19.8189 9.84082 19.5679 10.2162 19.2751C10.5344 19.0269 10.8229 18.7383 11.4001 18.1612L11.4001 18.1612L19.9213 9.63993L20.8482 8.71306C22.3839 7.17735 22.3839 4.68748 20.8482 3.15178C19.3125 1.61607 16.8226 1.61607 15.2869 3.15178Z",stroke:"currentColor","stroke-width":"1.5"}),t("path",{opacity:"0.5",d:"M14.36 4.07812C14.36 4.07812 14.4759 6.04774 16.2138 7.78564C17.9517 9.52354 19.9213 9.6394 19.9213 9.6394M4.19789 21.6777L2.32178 19.8015",stroke:"currentColor","stroke-width":"1.5"})],-1)]))),[[c,void 0,"edit"]]),n(p,{target:"edit"},{default:r(()=>e[41]||(e[41]=[g("Edit")])),_:1,__:[41]})]),_:1})]),t("div",null,[n(i,null,{default:r(()=>[u((o(),l("button",Pt,e[42]||(e[42]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5"},[t("path",{d:"M20.5001 6H3.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{d:"M18.8334 8.5L18.3735 15.3991C18.1965 18.054 18.108 19.3815 17.243 20.1907C16.378 21 15.0476 21 12.3868 21H11.6134C8.9526 21 7.6222 21 6.75719 20.1907C5.89218 19.3815 5.80368 18.054 5.62669 15.3991L5.16675 8.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M9.5 11L10 16",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M14.5 11L14 16",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M6.5 6C6.55588 6 6.58382 6 6.60915 5.99936C7.43259 5.97849 8.15902 5.45491 8.43922 4.68032C8.44784 4.65649 8.45667 4.62999 8.47434 4.57697L8.57143 4.28571C8.65431 4.03708 8.69575 3.91276 8.75071 3.8072C8.97001 3.38607 9.37574 3.09364 9.84461 3.01877C9.96213 3 10.0932 3 10.3553 3H13.6447C13.9068 3 14.0379 3 14.1554 3.01877C14.6243 3.09364 15.03 3.38607 15.2493 3.8072C15.3043 3.91276 15.3457 4.03708 15.4286 4.28571L15.5257 4.57697C15.5433 4.62992 15.5522 4.65651 15.5608 4.68032C15.841 5.45491 16.5674 5.97849 17.3909 5.99936C17.4162 6 17.4441 6 17.5 6",stroke:"currentColor","stroke-width":"1.5"})],-1)]))),[[c,void 0,"delete"]]),n(p,{target:"delete"},{default:r(()=>e[43]||(e[43]=[g("Delete")])),_:1,__:[43]})]),_:1})])])])]))),128))])])])]),d(m).includes("code6")?(o(),C(k,{key:0},{default:r(()=>e[45]||(e[45]=[t("pre",null,`<!-- progress table -->
<div class="table-responsive">
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Name</th>
        <th>Progress</th>
        <th>Sales</th>
        <th class="text-center">Action</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="data in tableData" :key="data.id">
        <tr>
          <td>{{ data.id }}</td>
          <td class="whitespace-nowrap">{{ data.name }}</td>
          <td>
            <div class="h-1.5 bg-[#ebedf2] dark:bg-dark/40 rounded-full flex w-full">
              <div
                class="h-1.5 rounded-full rounded-bl-full text-center text-white text-xs"
                :class="{
                  'bg-success': data.status === 'Complete',
                  'bg-secondary': data.status === 'Pending',
                  'bg-info': data.status === 'In Progress',
                  'bg-danger': data.status === 'Canceled',
                }"
                :style="\`width: \${data.progress}\`"
              ></div>
            </div>
          </td>
          <td
            class="whitespace-nowrap"
            :class="{
              'text-success': data.status === 'Complete',
              'text-secondary': data.status === 'Pending',
              'text-info': data.status === 'In Progress',
              'text-danger': data.status === 'Canceled',
            }"
          >
            {{ data.progress }}
          </td>
          <td class="p-3 border-b border-[#ebedf2] dark:border-[#191e3a] text-center text-white-dark">
            <div class="flex items-center">
              <div>
                <button type="button" v-tippy:edit>
                  <svg> ... </svg>
                </button>
                <tippy target="edit">Edit</tippy>
              </div>
              <div>
                <button type="button" v-tippy:delete>
                  <svg> ... </svg>
                </button>
                <tippy target="delete">Delete</tippy>
              </div>
            </div>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</div>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
const tableData = ref([
  {
    id: 1,
    name: 'John Doe',
    email: 'johndoe@yahoo.com',
    date: '10/08/2020',
    sale: 120,
    status: 'Complete',
    register: '5 min ago',
    progress: '40%',
    position: 'Developer',
    office: 'London',
  },
  .....
]);
<\/script>
`,-1)])),_:1,__:[45]})):w("",!0)]),t("div",St,[t("div",Nt,[e[47]||(e[47]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Contextual",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[6]||(e[6]=s=>d(v)("code7"))},e[46]||(e[46]=[h('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code</span>',1)]))]),e[49]||(e[49]=h('<div class="mb-5"><div class="table-responsive"><table><thead><tr><th>#</th><th>First Name</th><th>Last Name</th><th>Email</th></tr></thead><tbody><tr class="border-dark-dark-light bg-dark-dark-light"><td>1</td><td>John</td><td>Doe</td><td>johndoe@yahoo.com</td></tr><tr class="border-primary/20 bg-primary/20"><td>2</td><td>Andy</td><td>King</td><td>andyking@gmail.com</td></tr><tr class="border-secondary/20 bg-secondary/20"><td>3</td><td>Lisa</td><td>Doe</td><td>lisadoe@yahoo.com</td></tr><tr class="border-success/20 bg-success/20"><td>4</td><td>Vincent</td><td>Carpenter</td><td>vinnyc@yahoo.com</td></tr><tr class="border-dark-dark-light bg-dark-dark-light"><td>5</td><td>Amy</td><td>Diaz</td><td>amydiaz@yahoo.com</td></tr><tr class="border-danger/20 bg-danger/20"><td>6</td><td>Nia</td><td>Hillyer</td><td>niahill@gmail.com</td></tr><tr class="border-info/20 bg-info/20"><td>7</td><td>Marry</td><td>McDonald</td><td>marryMcD@yahoo.com</td></tr><tr class="border-warning/20 bg-warning/20"><td>8</td><td>Shaun</td><td>Park</td><td>park@yahoo.com</td></tr></tbody></table></div></div>',1)),d(m).includes("code7")?(o(),C(k,{key:0},{default:r(()=>e[48]||(e[48]=[t("pre",null,`<!-- contextual -->
<div class="table-responsive">
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>First Name</th>
        <th>Last Name</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>
      <tr class="bg-dark-dark-light border-dark-dark-light">
        <td>1</td>
        <td>John</td>
        <td>Doe</td>
        <td>johndoe@yahoo.com</td>
      </tr>
      <tr class="bg-primary/20 border-primary/20">
        <td>2</td>
        <td>Andy</td>
        <td>King</td>
        <td>andyking@gmail.com</td>
      </tr>
      <tr class="bg-secondary/20 border-secondary/20">
        <td>3</td>
        <td>Lisa</td>
        <td>Doe</td>
        <td>lisadoe@yahoo.com</td>
      </tr>
      <tr class="bg-success/20 border-success/20">
        <td>4</td>
        <td>Vincent</td>
        <td>Carpenter</td>
        <td>vinnyc@yahoo.com</td>
      </tr>
      <tr class="bg-dark-dark-light border-dark-dark-light">
        <td>5</td>
        <td>Amy</td>
        <td>Diaz</td>
        <td>amydiaz@yahoo.com</td>
      </tr>
      <tr class="bg-danger/20 border-danger/20">
        <td>6</td>
        <td>Nia</td>
        <td>Hillyer</td>
        <td>niahill@gmail.com</td>
      </tr>
      <tr class="bg-info/20 border-info/20">
        <td>7</td>
        <td>Marry</td>
        <td>McDonald</td>
        <td>marryMcD@yahoo.com</td>
      </tr>
      <tr class="bg-warning/20 border-warning/20">
        <td>8</td>
        <td>Shaun</td>
        <td>Park</td>
        <td>park@yahoo.com</td>
      </tr>
    </tbody>
  </table>
</div>
`,-1)])),_:1,__:[48]})):w("",!0)]),t("div",Bt,[t("div",At,[e[51]||(e[51]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Dropdown",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[7]||(e[7]=s=>d(v)("code8"))},e[50]||(e[50]=[h('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",Ht,[t("div",Et,[t("table",null,[e[54]||(e[54]=t("thead",null,[t("tr",null,[t("th",null,"Name"),t("th",null,"Date"),t("th",null,"Sale"),t("th",null,"Status"),t("th",{class:"text-center"},"Action")])],-1)),t("tbody",null,[(o(!0),l(f,null,y(b.value,s=>(o(),l("tr",{key:s.id},[t("td",It,a(s.name),1),t("td",null,a(s.date),1),t("td",null,a(s.sale),1),t("td",null,[t("span",{class:x(["badge whitespace-nowrap",{"bg-primary":s.status==="Complete","bg-secondary":s.status==="Pending","bg-success":s.status==="In Progress","bg-danger":s.status==="Canceled"}])},a(s.status),3)]),t("td",$t,[t("div",Jt,[n(i,null,{default:r(()=>[n(D,{placement:d(_).rtlClass==="rtl"?"bottom-start":"bottom-end",offsetDistance:"0",class:"align-middle"},{content:r(({close:M})=>[t("ul",{onClick:ne=>M()},e[52]||(e[52]=[t("li",null,[t("a",{href:"javascript:;"},"Download")],-1),t("li",null,[t("a",{href:"javascript:;"},"Share")],-1),t("li",null,[t("a",{href:"javascript:;"},"Edit")],-1),t("li",null,[t("a",{href:"javascript:;"},"Delete")],-1)]),8,zt)]),default:r(()=>[e[53]||(e[53]=t("a",{href:"javascript:;"},[t("svg",{class:"m-auto h-5 w-5 opacity-70",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg"},[t("circle",{cx:"5",cy:"12",r:"2",stroke:"currentColor","stroke-width":"1.5"}),t("circle",{opacity:"0.5",cx:"12",cy:"12",r:"2",stroke:"currentColor","stroke-width":"1.5"}),t("circle",{cx:"19",cy:"12",r:"2",stroke:"currentColor","stroke-width":"1.5"})])],-1))]),_:1,__:[53]},8,["placement"])]),_:1})])])]))),128))])])])]),d(m).includes("code8")?(o(),C(k,{key:0},{default:r(()=>e[55]||(e[55]=[t("pre",null,`<!-- dropdown -->
<div class="table-responsive">
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Date</th>
        <th>Sale</th>
        <th>Status</th>
        <th class="text-center">Action</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="data in tableData" :key="data.id">
        <tr>
          <td class="whitespace-nowrap">{{ data.name }}</td>
          <td>{{ data.date }}</td>
          <td>{{ data.sale }}</td>
          <td>
            <span
              class="badge whitespace-nowrap"
              :class="{
                'bg-primary': data.status === 'Complete',
                'bg-secondary': data.status === 'Pending',
                'bg-success': data.status === 'In Progress',
                'bg-danger': data.status === 'Canceled',
              }"
              >{{ data.status }}</span
            >
          </td>
          <td class="text-center">
            <div class="dropdown">
              <Popper :placement="store.rtlClass === 'rtl' ? 'bottom-start' : 'bottom-end'" offsetDistance="0" class="align-middle">
                <a href="javascript:;">
                  <svg> ... </svg>
                </a>
                <template #content="{ close }">
                  <ul @click="close()">
                    <li>
                      <a href="javascript:;">Download</a>
                    </li>
                    <li>
                      <a href="javascript:;">Share</a>
                    </li>
                    <li>
                      <a href="javascript:;">Edit</a>
                    </li>
                    <li>
                      <a href="javascript:;">Delete</a>
                    </li>
                  </ul>
                </template>
              </Popper>
            </div>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</div>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
const tableData = ref([
  {
    id: 1,
    name: 'John Doe',
    email: 'johndoe@yahoo.com',
    date: '10/08/2020',
    sale: 120,
    status: 'Complete',
    register: '5 min ago',
    progress: '40%',
    position: 'Developer',
    office: 'London',
  },
  .....
]);
<\/script>
`,-1)])),_:1,__:[55]})):w("",!0)]),t("div",Tt,[t("div",Vt,[e[57]||(e[57]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Table with Footer",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[8]||(e[8]=s=>d(v)("code9"))},e[56]||(e[56]=[h('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code</span>',1)]))]),t("div",Ft,[t("div",Ot,[t("table",null,[e[62]||(e[62]=t("thead",null,[t("tr",null,[t("th",null,"Name"),t("th",null,"Position"),t("th",null,"Office"),t("th",{class:"!text-center"},"Action")])],-1)),t("tbody",null,[(o(!0),l(f,null,y(b.value,s=>(o(),l("tr",{key:s.id},[t("td",Zt,a(s.name),1),t("td",null,a(s.position),1),t("td",null,a(s.office),1),t("td",Kt,[t("ul",Rt,[t("li",null,[n(i,null,{default:r(()=>[u((o(),l("a",qt,e[58]||(e[58]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 text-primary"},[t("circle",{opacity:"0.5",cx:"12",cy:"12",r:"10",stroke:"currentColor","stroke-width":"1.5"}),t("path",{d:"M8.5 12.5L10.5 14.5L15.5 9.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"})],-1)]))),[[c,void 0,"edit"]]),n(p,{target:"edit"},{default:r(()=>e[59]||(e[59]=[g("Edit")])),_:1,__:[59]})]),_:1})]),t("li",null,[n(i,null,{default:r(()=>[u((o(),l("a",Yt,e[60]||(e[60]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 text-danger"},[t("circle",{opacity:"0.5",cx:"12",cy:"12",r:"10",stroke:"currentColor","stroke-width":"1.5"}),t("path",{d:"M14.5 9.50002L9.5 14.5M9.49998 9.5L14.5 14.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"})],-1)]))),[[c,void 0,"delete"]]),n(p,{target:"delete"},{default:r(()=>e[61]||(e[61]=[g("Delete")])),_:1,__:[61]})]),_:1})])])])]))),128))]),e[63]||(e[63]=t("tfoot",null,[t("tr",null,[t("th",null,"Name"),t("th",null,"Position"),t("th",null,"Office"),t("th",{class:"!text-center"},"Action")])],-1))])])]),d(m).includes("code9")?(o(),C(k,{key:0},{default:r(()=>e[64]||(e[64]=[t("pre",null,`<!-- table with footer -->
<div class="table-responsive">
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Position</th>
        <th>Office</th>
        <th class="!text-center">Action</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="data in tableData" :key="data.id">
        <tr>
          <td class="whitespace-nowrap">{{ data.name }}</td>
          <td>{{ data.position }}</td>
          <td>{{ data.office }}</td>
          <td class="text-center">
            <ul class="flex items-center justify-center gap-2">
              <li>
                <a href="javascript:;" v-tippy:edit>
                  <svg> ... </svg>
                </a>
                <tippy target="edit">Edit</tippy>
              </li>
              <li>
                <a href="javascript:;" v-tippy:delete>
                  <svg> ... </svg>
                </a>
                <tippy target="delete">Delete</tippy>
              </li>
            </ul>
          </td>
        </tr>
      </template>
    </tbody>
    <tfoot>
      <tr>
        <th>Name</th>
        <th>Position</th>
        <th>Office</th>
        <th class="!text-center">Action</th>
      </tr>
    </tfoot>
  </table>
</div>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
const tableData = ref([
  {
    id: 1,
    name: 'John Doe',
    email: 'johndoe@yahoo.com',
    date: '10/08/2020',
    sale: 120,
    status: 'Complete',
    register: '5 min ago',
    progress: '40%',
    position: 'Developer',
    office: 'London',
  },
  .....
]);
<\/script>
`,-1)])),_:1,__:[64]})):w("",!0)]),t("div",Gt,[t("div",Qt,[e[66]||(e[66]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Checkboxes",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[9]||(e[9]=s=>d(v)("code10"))},e[65]||(e[65]=[h('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code</span>',1)]))]),t("div",Ut,[t("div",Wt,[t("table",null,[e[74]||(e[74]=t("thead",null,[t("tr",null,[t("th",null,[t("input",{type:"checkbox",class:"form-checkbox"})]),t("th",null,"Name"),t("th",null,"Date"),t("th",null,"Sale"),t("th",{class:"!text-center"},"Action")])],-1)),t("tbody",null,[(o(!0),l(f,null,y(b.value,s=>(o(),l("tr",{key:s.id},[e[73]||(e[73]=t("td",null,[t("input",{type:"checkbox",class:"form-checkbox"})],-1)),t("td",Xt,a(s.name),1),t("td",null,a(s.date),1),t("td",null,a(s.sale),1),t("td",te,[t("ul",ee,[t("li",null,[n(i,null,{default:r(()=>[u((o(),l("a",se,e[67]||(e[67]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 text-primary"},[t("circle",{cx:"12",cy:"12",r:"3",stroke:"currentColor","stroke-width":"1.5"}),t("path",{opacity:"0.5",d:"M13.7654 2.15224C13.3978 2 12.9319 2 12 2C11.0681 2 10.6022 2 10.2346 2.15224C9.74457 2.35523 9.35522 2.74458 9.15223 3.23463C9.05957 3.45834 9.0233 3.7185 9.00911 4.09799C8.98826 4.65568 8.70226 5.17189 8.21894 5.45093C7.73564 5.72996 7.14559 5.71954 6.65219 5.45876C6.31645 5.2813 6.07301 5.18262 5.83294 5.15102C5.30704 5.08178 4.77518 5.22429 4.35436 5.5472C4.03874 5.78938 3.80577 6.1929 3.33983 6.99993C2.87389 7.80697 2.64092 8.21048 2.58899 8.60491C2.51976 9.1308 2.66227 9.66266 2.98518 10.0835C3.13256 10.2756 3.3397 10.437 3.66119 10.639C4.1338 10.936 4.43789 11.4419 4.43786 12C4.43783 12.5581 4.13375 13.0639 3.66118 13.3608C3.33965 13.5629 3.13248 13.7244 2.98508 13.9165C2.66217 14.3373 2.51966 14.8691 2.5889 15.395C2.64082 15.7894 2.87379 16.193 3.33973 17C3.80568 17.807 4.03865 18.2106 4.35426 18.4527C4.77508 18.7756 5.30694 18.9181 5.83284 18.8489C6.07289 18.8173 6.31632 18.7186 6.65204 18.5412C7.14547 18.2804 7.73556 18.27 8.2189 18.549C8.70224 18.8281 8.98826 19.3443 9.00911 19.9021C9.02331 20.2815 9.05957 20.5417 9.15223 20.7654C9.35522 21.2554 9.74457 21.6448 10.2346 21.8478C10.6022 22 11.0681 22 12 22C12.9319 22 13.3978 22 13.7654 21.8478C14.2554 21.6448 14.6448 21.2554 14.8477 20.7654C14.9404 20.5417 14.9767 20.2815 14.9909 19.902C15.0117 19.3443 15.2977 18.8281 15.781 18.549C16.2643 18.2699 16.8544 18.2804 17.3479 18.5412C17.6836 18.7186 17.927 18.8172 18.167 18.8488C18.6929 18.9181 19.2248 18.7756 19.6456 18.4527C19.9612 18.2105 20.1942 17.807 20.6601 16.9999C21.1261 16.1929 21.3591 15.7894 21.411 15.395C21.4802 14.8691 21.3377 14.3372 21.0148 13.9164C20.8674 13.7243 20.6602 13.5628 20.3387 13.3608C19.8662 13.0639 19.5621 12.558 19.5621 11.9999C19.5621 11.4418 19.8662 10.9361 20.3387 10.6392C20.6603 10.4371 20.8675 10.2757 21.0149 10.0835C21.3378 9.66273 21.4803 9.13087 21.4111 8.60497C21.3592 8.21055 21.1262 7.80703 20.6602 7C20.1943 6.19297 19.9613 5.78945 19.6457 5.54727C19.2249 5.22436 18.693 5.08185 18.1671 5.15109C17.9271 5.18269 17.6837 5.28136 17.3479 5.4588C16.8545 5.71959 16.2644 5.73002 15.7811 5.45096C15.2977 5.17191 15.0117 4.65566 14.9909 4.09794C14.9767 3.71848 14.9404 3.45833 14.8477 3.23463C14.6448 2.74458 14.2554 2.35523 13.7654 2.15224Z",stroke:"currentColor","stroke-width":"1.5"})],-1)]))),[[c,void 0,"settings"]]),n(p,{target:"settings"},{default:r(()=>e[68]||(e[68]=[g("Settings")])),_:1,__:[68]})]),_:1})]),t("li",null,[n(i,null,{default:r(()=>[u((o(),l("a",oe,e[69]||(e[69]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-4.5 w-4.5 text-success"},[t("path",{d:"M15.2869 3.15178L14.3601 4.07866L5.83882 12.5999L5.83881 12.5999C5.26166 13.1771 4.97308 13.4656 4.7249 13.7838C4.43213 14.1592 4.18114 14.5653 3.97634 14.995C3.80273 15.3593 3.67368 15.7465 3.41556 16.5208L2.32181 19.8021L2.05445 20.6042C1.92743 20.9852 2.0266 21.4053 2.31063 21.6894C2.59466 21.9734 3.01478 22.0726 3.39584 21.9456L4.19792 21.6782L7.47918 20.5844L7.47919 20.5844C8.25353 20.3263 8.6407 20.1973 9.00498 20.0237C9.43469 19.8189 9.84082 19.5679 10.2162 19.2751C10.5344 19.0269 10.8229 18.7383 11.4001 18.1612L11.4001 18.1612L19.9213 9.63993L20.8482 8.71306C22.3839 7.17735 22.3839 4.68748 20.8482 3.15178C19.3125 1.61607 16.8226 1.61607 15.2869 3.15178Z",stroke:"currentColor","stroke-width":"1.5"}),t("path",{opacity:"0.5",d:"M14.36 4.07812C14.36 4.07812 14.4759 6.04774 16.2138 7.78564C17.9517 9.52354 19.9213 9.6394 19.9213 9.6394M4.19789 21.6777L2.32178 19.8015",stroke:"currentColor","stroke-width":"1.5"})],-1)]))),[[c,void 0,"edit"]]),n(p,{target:"edit"},{default:r(()=>e[70]||(e[70]=[g("Edit")])),_:1,__:[70]})]),_:1})]),t("li",null,[n(i,null,{default:r(()=>[u((o(),l("a",re,e[71]||(e[71]=[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 text-danger"},[t("path",{d:"M20.5001 6H3.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{d:"M18.8334 8.5L18.3735 15.3991C18.1965 18.054 18.108 19.3815 17.243 20.1907C16.378 21 15.0476 21 12.3868 21H11.6134C8.9526 21 7.6222 21 6.75719 20.1907C5.89218 19.3815 5.80368 18.054 5.62669 15.3991L5.16675 8.5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M9.5 11L10 16",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M14.5 11L14 16",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),t("path",{opacity:"0.5",d:"M6.5 6C6.55588 6 6.58382 6 6.60915 5.99936C7.43259 5.97849 8.15902 5.45491 8.43922 4.68032C8.44784 4.65649 8.45667 4.62999 8.47434 4.57697L8.57143 4.28571C8.65431 4.03708 8.69575 3.91276 8.75071 3.8072C8.97001 3.38607 9.37574 3.09364 9.84461 3.01877C9.96213 3 10.0932 3 10.3553 3H13.6447C13.9068 3 14.0379 3 14.1554 3.01877C14.6243 3.09364 15.03 3.38607 15.2493 3.8072C15.3043 3.91276 15.3457 4.03708 15.4286 4.28571L15.5257 4.57697C15.5433 4.62992 15.5522 4.65651 15.5608 4.68032C15.841 5.45491 16.5674 5.97849 17.3909 5.99936C17.4162 6 17.4441 6 17.5 6",stroke:"currentColor","stroke-width":"1.5"})],-1)]))),[[c,void 0,"delete"]]),n(p,{target:"delete"},{default:r(()=>e[72]||(e[72]=[g("Delete")])),_:1,__:[72]})]),_:1})])])])]))),128))])])])]),d(m).includes("code10")?(o(),C(k,{key:0},{default:r(()=>e[75]||(e[75]=[t("pre",null,`<!-- dropdown -->
<div class="table-responsive">
  <table>
    <thead>
      <tr>
        <th><input type="checkbox" class="form-checkbox" /></th>
        <th>Name</th>
        <th>Date</th>
        <th>Sale</th>
        <th class="!text-center">Action</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="data in tableData" :key="data.id">
        <tr>
          <td><input type="checkbox" class="form-checkbox" /></td>
          <td class="whitespace-nowrap">{{ data.name }}</td>
          <td>{{ data.date }}</td>
          <td>{{ data.sale }}</td>
          <td class="text-center">
            <ul class="flex items-center justify-center gap-2">
              <li>
                <a href="javascript:;" v-tippy:settings> <svg> ... </svg></a>
                <tippy target="settings">Edit</tippy>
              </li>
              <li>
                <a href="javascript:;" v-tippy:edit> <svg> ... </svg></a>
                <tippy target="edit">Edit</tippy>
              </li>
              <li>
                <a href="javascript:;" v-tippy:delete> <svg> ... </svg></a>
                <tippy target="delete">Edit</tippy>
              </li>
            </ul>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</div>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
const tableData = ref([
  {
    id: 1,
    name: 'John Doe',
    email: 'johndoe@yahoo.com',
    date: '10/08/2020',
    sale: 120,
    status: 'Complete',
    register: '5 min ago',
    progress: '40%',
    position: 'Developer',
    office: 'London',
  },
  .....
]);
<\/script>
`,-1)])),_:1,__:[75]})):w("",!0)])])])}}});export{he as default};
