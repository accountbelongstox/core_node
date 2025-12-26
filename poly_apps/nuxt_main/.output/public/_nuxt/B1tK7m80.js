import{c as v,h as p}from"./Bykx_eDL.js";import{S as w}from"./BQIkj5Wb.js";import{u as C}from"./CPc_GOQr.js";import{d as h,u as x,h as y,k as o,q as r,c,s as b,v as e,b as m,g as l}from"./Cs8kveBG.js";import"./92s3wAHG.js";const B={class:"space-y-8 pt-5"},L={class:"grid grid-cols-1 gap-6 lg:grid-cols-2"},M={class:"panel"},E={class:"mb-5 flex items-center justify-between"},$={class:"mb-5"},j={class:"flex items-center justify-center"},T={class:"panel lg:row-span-2"},S={class:"mb-5 flex items-center justify-between"},D={class:"mb-5"},H={class:"mb-10 flex items-center justify-center gap-2"},N={class:"flex items-center justify-center gap-2"},A={class:"panel"},P={class:"mb-5 flex items-center justify-between"},V={class:"mb-5"},I={class:"flex items-center justify-center"},R={class:"panel"},O={class:"mb-5 flex items-center justify-between"},W={class:"mb-5"},q={class:"flex items-center justify-center"},Z={class:"panel"},z={class:"mb-5 flex items-center justify-between"},F={class:"mb-5"},G={class:"flex items-center justify-center"},J={class:"panel lg:col-span-2"},K={class:"mb-5 flex items-center justify-between"},Q={class:"mb-5"},U={class:"colored-toast grid grid-cols-2 items-center justify-center gap-2 sm:flex sm:grid-cols-1"},it=h({__name:"notifications",setup(X){x({title:"Notification"});const f=C(),{codeArr:a,toggleCode:d}=v(),n=(i="Example notification text.",t="bottom-start",s=!0,Y="",g=3e3)=>{w.mixin({toast:!0,position:t||"bottom-start",showConfirmButton:!1,timer:g,showCloseButton:s}).fire({title:i})},k=()=>{w.fire({toast:!0,position:"bottom-start",text:"Custom callback when action button is clicked.",showCloseButton:!0,showConfirmButton:!1}).then(i=>{w.fire({toast:!0,position:"bottom-start",text:"Thanks for clicking the Dismiss button!",showCloseButton:!0,showConfirmButton:!1})})},u=i=>{w.mixin({toast:!0,position:"bottom-start",showConfirmButton:!1,timer:3e3,showCloseButton:!0,customClass:{popup:`color-${i}`},target:document.getElementById(i+"-toast")||"body"}).fire({title:"Example notification text."})};return(i,t)=>(l(),y("div",null,[t[49]||(t[49]=o("ul",{class:"flex space-x-2 rtl:space-x-reverse"},[o("li",null,[o("a",{href:"javascript:;",class:"text-primary hover:underline"},"Components")]),o("li",{class:"before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"},[o("span",null,"Notifications")])],-1)),o("div",B,[t[48]||(t[48]=r('<div class="panel flex items-center overflow-x-auto whitespace-nowrap p-3 text-primary"><div class="rounded-full bg-primary p-1.5 text-white ring-2 ring-primary/30 ltr:mr-3 rtl:ml-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5"><path d="M19.0001 9.7041V9C19.0001 5.13401 15.8661 2 12.0001 2C8.13407 2 5.00006 5.13401 5.00006 9V9.7041C5.00006 10.5491 4.74995 11.3752 4.28123 12.0783L3.13263 13.8012C2.08349 15.3749 2.88442 17.5139 4.70913 18.0116C9.48258 19.3134 14.5175 19.3134 19.291 18.0116C21.1157 17.5139 21.9166 15.3749 20.8675 13.8012L19.7189 12.0783C19.2502 11.3752 19.0001 10.5491 19.0001 9.7041Z" stroke="currentColor" stroke-width="1.5"></path><path opacity="0.5" d="M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></div><span class="ltr:mr-3 rtl:ml-3">Documentation: </span><a href="https://www.npmjs.com/package/sweetalert2" target="_blank" class="block hover:underline">https://www.npmjs.com/package/sweetalert2</a></div>',1)),o("div",L,[o("div",M,[o("div",E,[t[23]||(t[23]=o("h5",{class:"text-lg font-semibold dark:text-white-light"},"Basic",-1)),o("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[0]||(t[0]=s=>e(d)("code1"))},t[22]||(t[22]=[r('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),o("div",$,[o("div",j,[o("button",{type:"button",class:"btn btn-primary",onClick:t[1]||(t[1]=s=>n("Hello, world! This is a toast message."))},"Open Toast")])]),e(a).includes("code1")?(l(),c(p,{key:0},{default:m(()=>t[24]||(t[24]=[o("pre",null,`<!-- basic -->
<button type="button" class="btn btn-primary" @click="showMessage('Hello, world! This is a toast message.')">Open Toast</button>

<!-- script -->
<script>
    const showMessage = (msg = 'Example notification text.', position = 'bottom-start', showCloseButton = true, closeButtonHtml = '', duration = 3000) => {
        const toast = Swal.mixin({
            toast: true,
            position: position || 'bottom-start',
            showConfirmButton: false,
            timer: duration,
            showCloseButton: showCloseButton,
        });
        toast.fire({
            title: msg,
        });
    };
<\/script>
`,-1)])),_:1,__:[24]})):b("",!0)]),o("div",T,[o("div",S,[t[26]||(t[26]=o("h5",{class:"text-lg font-semibold dark:text-white-light"},"Position",-1)),o("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[2]||(t[2]=s=>e(d)("code2"))},t[25]||(t[25]=[r('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),o("div",D,[t[27]||(t[27]=o("h6",{class:"mb-3 text-center text-base font-semibold dark:text-white-light"},"Top Position",-1)),o("div",H,[o("button",{type:"button",class:"btn btn-success",onClick:t[3]||(t[3]=s=>n("Example notification text.",e(f).rtlClass==="rtl"?"top-end":"top-start"))}," Top Left "),o("button",{type:"button",class:"btn btn-secondary",onClick:t[4]||(t[4]=s=>n("Example notification text","top"))},"Top Center"),o("button",{type:"button",class:"btn btn-info",onClick:t[5]||(t[5]=s=>n("Example notification text.",e(f).rtlClass==="rtl"?"top-start":"top-end"))}," Top Right ")]),t[28]||(t[28]=o("h6",{class:"mb-3 text-center text-base font-semibold dark:text-white-light"},"Bottom Position",-1)),o("div",N,[o("button",{type:"button",class:"btn btn-dark",onClick:t[6]||(t[6]=s=>n("Example notification text.",e(f).rtlClass==="rtl"?"bottom-end":"bottom-start"))}," Bottom Left "),o("button",{type:"button",class:"btn btn-primary",onClick:t[7]||(t[7]=s=>n("Example notification text.","bottom"))},"Bottom Center"),o("button",{type:"button",class:"btn btn-secondary",onClick:t[8]||(t[8]=s=>n("Example notification text.",e(f).rtlClass==="rtl"?"bottom-start":"bottom-end"))}," Bottom Right ")])]),e(a).includes("code2")?(l(),c(p,{key:0},{default:m(()=>t[29]||(t[29]=[o("pre",null,`<!-- top left -->
<button type="button" class="btn btn-success" @click="showMessage('Example notification text.',store.rtlClass === 'rtl' ? 'top-end' : 'top-start')">Top Left</button>

<!-- top center -->
<button type="button" class="btn btn-secondary" @click="showMessage('Example notification text','top')">Top Center</button>

<!-- top right -->
<button type="button" class="btn btn-info" @click="showMessage('Example notification text.', store.rtlClass === 'rtl' ? 'top-start' : 'top-end')">Top Right</button>

<!-- bottom left -->
<button type="button" class="btn btn-dark" @click="showMessage('Example notification text.',store.rtlClass === 'rtl' ? 'bottom-end' : 'bottom-start')">Bottom Left</button>

<!-- bottom center -->
<button type="button" class="btn btn-primary" @click="showMessage('Example notification text.','bottom')">Bottom Center</button>

<!-- bottom right -->
<button type="button" class="btn btn-secondary" @click="showMessage('Example notification text.',store.rtlClass === 'rtl' ? 'bottom-start' : 'bottom-end')">Bottom Right</button>

<!-- script -->
<script>
  import { useAppStore } from '@/stores/index';
  const store = useAppStore();
  const showMessage = (msg = 'Example notification text.', position = 'bottom-start', showCloseButton = true, closeButtonHtml = '', duration = 3000) => {
      const toast = Swal.mixin({
          toast: true,
          position: position || 'bottom-start',
          showConfirmButton: false,
          timer: duration,
          showCloseButton: showCloseButton,
      });
      toast.fire({
          title: msg,
      });
  };
<\/script>
`,-1)])),_:1,__:[29]})):b("",!0)]),o("div",A,[o("div",P,[t[31]||(t[31]=o("h5",{class:"text-lg font-semibold dark:text-white-light"},"No Action",-1)),o("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[9]||(t[9]=s=>e(d)("code3"))},t[30]||(t[30]=[r('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),o("div",V,[o("div",I,[o("button",{type:"button",class:"btn btn-success",onClick:t[10]||(t[10]=s=>n("Example notification text.","bottom-start",!1))}," No Action ")])]),e(a).includes("code3")?(l(),c(p,{key:0},{default:m(()=>t[32]||(t[32]=[o("pre",null,`<!-- no action -->
<button type="button" class="btn btn-success" @click="showMessage('Example notification text.', 'bottom-start',false)">No Action</button>

<!-- script -->
<script>
    const showMessage = (msg = 'Example notification text.', position = 'bottom-start', showCloseButton = true, closeButtonHtml = '', duration = 3000) => {
        const toast = Swal.mixin({
            toast: true,
            position: position || 'bottom-start',
            showConfirmButton: false,
            timer: duration,
            showCloseButton: showCloseButton,
        });
        toast.fire({
            title: msg,
        });
    };
<\/script>
`,-1)])),_:1,__:[32]})):b("",!0)]),o("div",R,[o("div",O,[t[34]||(t[34]=o("h5",{class:"text-lg font-semibold dark:text-white-light"},"Click Callback",-1)),o("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[11]||(t[11]=s=>e(d)("code4"))},t[33]||(t[33]=[r('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),o("div",W,[o("div",q,[o("button",{type:"button",class:"btn btn-info",onClick:t[12]||(t[12]=s=>k())},"Click Callback")])]),e(a).includes("code4")?(l(),c(p,{key:0},{default:m(()=>t[35]||(t[35]=[o("pre",null,`<!-- click callback -->
<button type="button" class="btn btn-info" @click="clickCallable()">Click Callback</button>

<!-- script -->
<script>
    const clickCallable = () => {
        Swal.fire({
            toast: true,
            position: 'bottom-start',
            text: "Custom callback when action button is clicked.",
            showCloseButton: true,
            showConfirmButton: false,
        }).then((result) => {
            Swal.fire({
                toast: true,
                position: 'bottom-start',
                text: 'Thanks for clicking the Dismiss button!',
                showCloseButton: true,
                showConfirmButton: false,
            });
        });
    };
<\/script>
`,-1)])),_:1,__:[35]})):b("",!0)]),o("div",Z,[o("div",z,[t[37]||(t[37]=o("h5",{class:"text-lg font-semibold dark:text-white-light"},"Duration",-1)),o("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[13]||(t[13]=s=>e(d)("code5"))},t[36]||(t[36]=[r('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),o("div",F,[o("div",G,[o("button",{type:"button",class:"btn btn-dark",onClick:t[14]||(t[14]=s=>n(i.msg="Example notification text.",i.position="bottom-start",i.duration=5e3))}," Duration ")])]),e(a).includes("code5")?(l(),c(p,{key:0},{default:m(()=>t[38]||(t[38]=[o("pre",null,`<!-- click callback -->
<button type="button" class="btn btn-dark" @click="showMessage(msg='Example notification text.', position= 'bottom-start', duration=5000)">Duration</button>

<!-- script -->
<script>
    const showMessage = (msg = 'Example notification text.', position = 'bottom-start', showCloseButton = true, closeButtonHtml = '', duration = 3000) => {
        const toast = Swal.mixin({
            toast: true,
            position: position || 'bottom-start',
            showConfirmButton: false,
            timer: duration,
            showCloseButton: showCloseButton,
        });
        toast.fire({
            title: msg,
        });
    };
<\/script>
`,-1)])),_:1,__:[38]})):b("",!0)]),o("div",J,[o("div",K,[t[40]||(t[40]=o("h5",{class:"text-lg font-semibold dark:text-white-light"},"Background Color",-1)),o("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[15]||(t[15]=s=>e(d)("code6"))},t[39]||(t[39]=[r('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),o("div",Q,[o("div",U,[o("div",null,[o("button",{type:"button",class:"btn btn-primary",onClick:t[16]||(t[16]=s=>u("primary"))},"Primary"),t[41]||(t[41]=o("div",{id:"primary-toast"},null,-1))]),o("div",null,[o("button",{type:"button",class:"btn btn-secondary",onClick:t[17]||(t[17]=s=>u("secondary"))},"Secondary"),t[42]||(t[42]=o("div",{id:"secondary-toast"},null,-1))]),o("div",null,[o("button",{type:"button",class:"btn btn-success",onClick:t[18]||(t[18]=s=>u("success"))},"Success"),t[43]||(t[43]=o("div",{id:"success-toast"},null,-1))]),o("div",null,[o("button",{type:"button",class:"btn btn-danger",onClick:t[19]||(t[19]=s=>u("danger"))},"Danger"),t[44]||(t[44]=o("div",{id:"danger-toast"},null,-1))]),o("div",null,[o("button",{type:"button",class:"btn btn-warning",onClick:t[20]||(t[20]=s=>u("warning"))},"Warning"),t[45]||(t[45]=o("div",{id:"warning-toast"},null,-1))]),o("div",null,[o("button",{type:"button",class:"btn btn-info",onClick:t[21]||(t[21]=s=>u("info"))},"Info"),t[46]||(t[46]=o("div",{id:"info-toast"},null,-1))])])]),e(a).includes("code6")?(l(),c(p,{key:0},{default:m(()=>t[47]||(t[47]=[o("pre",null,`<!-- primary -->
<div>
    <button type="button" class="btn btn-primary" @click="coloredToast('primary')">Primary</button>
    <div id="primary-toast"></div>
</div>

<!-- secondary -->
<div>
    <button type=" button" class="btn btn-secondary" @click="coloredToast('secondary')">Secondary</button>
    <div id="secondary-toast"></div>
</div>

<!-- success -->
<div>
    <button type="button" class="btn btn-success" @click="coloredToast('success')">Success</button>
    <div id="success-toast"></div>
</div>

<!-- danger -->
<div>
    <button type="button" class="btn btn-danger" @click="coloredToast('danger')">Danger</button>
    <div id="danger-toast"></div>
</div>

<!-- warning -->
<div>
    <button type="button" class="btn btn-warning" @click="coloredToast('warning')">Warning</button>
    <div id="warning-toast"></div>
</div>

<!-- info -->
<div>
    <button type="button" class="btn btn-info" @click="coloredToast('info')">Info</button>
    <div id="info-toast"></div>
</div>

<!-- script -->
<script>
    const coloredToast = (color) => {
        const toast = Swal.mixin({
            toast: true,
            position: 'bottom-start',
            showConfirmButton: false,
            timer: 3000,
            showCloseButton: true,
            customClass: {
                popup: \`color-\${color}\`
            },
            target: document.getElementById(color + '-toast')
        });
        toast.fire({
            title: 'Example notification text.',
        });
    };
<\/script>
`,-1)])),_:1,__:[47]})):b("",!0)])])])]))}});export{it as default};
