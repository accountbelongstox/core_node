import{_ as ie}from"./DJsYY-sz.js";import{D as X,d as ae,u as oe,r as le,h as k,k as t,q as S,c as p,s as E,v as s,b as l,F as M,A as T,l as O,g as a}from"./Cs8kveBG.js";import{c as ne,h as B}from"./Bykx_eDL.js";import{g as F,S as v,N,P as A,a as _}from"./GMUTa1zX.js";import{u as pe}from"./CPc_GOQr.js";import"./92s3wAHG.js";function W(q){let{swiper:e,extendParams:f,on:d,emit:n,params:y}=q;e.autoplay={running:!1,paused:!1,timeLeft:0},f({autoplay:{enabled:!1,delay:3e3,waitForTransition:!0,disableOnInteraction:!1,stopOnLastSlide:!1,reverseDirection:!1,pauseOnMouseEnter:!1}});let r,o,u=y&&y.autoplay?y.autoplay.delay:3e3,P=y&&y.autoplay?y.autoplay.delay:3e3,c,C=new Date().getTime(),D,z,x,R,V,g,$;function H(i){!e||e.destroyed||!e.wrapperEl||i.target===e.wrapperEl&&(e.wrapperEl.removeEventListener("transitionend",H),!($||i.detail&&i.detail.bySwiperTouchMove)&&h())}const U=()=>{if(e.destroyed||!e.autoplay.running)return;e.autoplay.paused?D=!0:D&&(P=c,D=!1);const i=e.autoplay.paused?c:C+P-new Date().getTime();e.autoplay.timeLeft=i,n("autoplayTimeLeft",i,i/u),o=requestAnimationFrame(()=>{U()})},Y=()=>{let i;return e.virtual&&e.params.virtual.enabled?i=e.slides.find(m=>m.classList.contains("swiper-slide-active")):i=e.slides[e.activeIndex],i?parseInt(i.getAttribute("data-swiper-autoplay"),10):void 0},I=i=>{if(e.destroyed||!e.autoplay.running)return;cancelAnimationFrame(o),U();let w=typeof i>"u"?e.params.autoplay.delay:i;u=e.params.autoplay.delay,P=e.params.autoplay.delay;const m=Y();!Number.isNaN(m)&&m>0&&typeof i>"u"&&(w=m,u=m,P=m),c=w;const j=e.params.speed,Q=()=>{!e||e.destroyed||(e.params.autoplay.reverseDirection?!e.isBeginning||e.params.loop||e.params.rewind?(e.slidePrev(j,!0,!0),n("autoplay")):e.params.autoplay.stopOnLastSlide||(e.slideTo(e.slides.length-1,j,!0,!0),n("autoplay")):!e.isEnd||e.params.loop||e.params.rewind?(e.slideNext(j,!0,!0),n("autoplay")):e.params.autoplay.stopOnLastSlide||(e.slideTo(0,j,!0,!0),n("autoplay")),e.params.cssMode&&(C=new Date().getTime(),requestAnimationFrame(()=>{I()})))};return w>0?(clearTimeout(r),r=setTimeout(()=>{Q()},w)):requestAnimationFrame(()=>{Q()}),w},Z=()=>{C=new Date().getTime(),e.autoplay.running=!0,I(),n("autoplayStart")},L=()=>{e.autoplay.running=!1,clearTimeout(r),cancelAnimationFrame(o),n("autoplayStop")},b=(i,w)=>{if(e.destroyed||!e.autoplay.running)return;clearTimeout(r),i||(g=!0);const m=()=>{n("autoplayPause"),e.params.autoplay.waitForTransition?e.wrapperEl.addEventListener("transitionend",H):h()};if(e.autoplay.paused=!0,w){V&&(c=e.params.autoplay.delay),V=!1,m();return}c=(c||e.params.autoplay.delay)-(new Date().getTime()-C),!(e.isEnd&&c<0&&!e.params.loop)&&(c<0&&(c=0),m())},h=()=>{e.isEnd&&c<0&&!e.params.loop||e.destroyed||!e.autoplay.running||(C=new Date().getTime(),g?(g=!1,I(c)):I(),e.autoplay.paused=!1,n("autoplayResume"))},G=()=>{if(e.destroyed||!e.autoplay.running)return;const i=F();i.visibilityState==="hidden"&&(g=!0,b(!0)),i.visibilityState==="visible"&&h()},J=i=>{i.pointerType==="mouse"&&(g=!0,$=!0,!(e.animating||e.autoplay.paused)&&b(!0))},K=i=>{i.pointerType==="mouse"&&($=!1,e.autoplay.paused&&h())},ee=()=>{e.params.autoplay.pauseOnMouseEnter&&(e.el.addEventListener("pointerenter",J),e.el.addEventListener("pointerleave",K))},te=()=>{e.el&&typeof e.el!="string"&&(e.el.removeEventListener("pointerenter",J),e.el.removeEventListener("pointerleave",K))},re=()=>{F().addEventListener("visibilitychange",G)},se=()=>{F().removeEventListener("visibilitychange",G)};d("init",()=>{e.params.autoplay.enabled&&(ee(),re(),Z())}),d("destroy",()=>{te(),se(),e.autoplay.running&&L()}),d("_freeModeStaticRelease",()=>{(x||g)&&h()}),d("_freeModeNoMomentumRelease",()=>{e.params.autoplay.disableOnInteraction?L():b(!0,!0)}),d("beforeTransitionStart",(i,w,m)=>{e.destroyed||!e.autoplay.running||(m||!e.params.autoplay.disableOnInteraction?b(!0,!0):L())}),d("sliderFirstMove",()=>{if(!(e.destroyed||!e.autoplay.running)){if(e.params.autoplay.disableOnInteraction){L();return}z=!0,x=!1,g=!1,R=setTimeout(()=>{g=!0,x=!0,b(!0)},200)}}),d("touchEnd",()=>{if(!(e.destroyed||!e.autoplay.running||!z)){if(clearTimeout(R),clearTimeout(r),e.params.autoplay.disableOnInteraction){x=!1,z=!1;return}x&&e.params.cssMode&&h(),x=!1,z=!1}}),d("slideChange",()=>{e.destroyed||!e.autoplay.running||(V=!0)}),Object.assign(e.autoplay,{start:Z,stop:L,pause:b,resume:h})}const de=X("/assets/images/carousel2.jpeg"),ue=X("/assets/images/carousel3.jpeg"),me={class:"space-y-8 pt-5"},ce={class:"grid grid-cols-1 gap-6 lg:grid-cols-2"},we={class:"panel"},ge={class:"mb-5 flex items-center justify-between"},ve=["src"],fe={class:"panel"},ye={class:"mb-5 flex items-center justify-between"},he=["src"],xe={class:"panel"},be={class:"mb-5 flex items-center justify-between"},ke=["src"],Se={class:"panel"},Ce={class:"mb-5 flex items-center justify-between"},Le={class:"panel lg:col-span-2"},je={class:"mb-5 flex items-center justify-between"},Ee=["src"],Me=["src"],Ne=ae({__name:"carousel",setup(q){const e=pe();oe({title:"Carousel"});const{codeArr:f,toggleCode:d}=ne(),n=le(["carousel1.jpeg","carousel2.jpeg","carousel3.jpeg"]);return(y,r)=>(a(),k("div",null,[r[34]||(r[34]=t("ul",{class:"flex space-x-2 rtl:space-x-reverse"},[t("li",null,[t("a",{href:"javascript:;",class:"text-primary hover:underline"},"Components")]),t("li",{class:"before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"},[t("span",null,"Carousel")])],-1)),t("div",me,[r[33]||(r[33]=S('<div class="panel flex items-center overflow-x-auto whitespace-nowrap p-3 text-primary"><div class="rounded-full bg-primary p-1.5 text-white ring-2 ring-primary/30 ltr:mr-3 rtl:ml-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5"><path d="M19.0001 9.7041V9C19.0001 5.13401 15.8661 2 12.0001 2C8.13407 2 5.00006 5.13401 5.00006 9V9.7041C5.00006 10.5491 4.74995 11.3752 4.28123 12.0783L3.13263 13.8012C2.08349 15.3749 2.88442 17.5139 4.70913 18.0116C9.48258 19.3134 14.5175 19.3134 19.291 18.0116C21.1157 17.5139 21.9166 15.3749 20.8675 13.8012L19.7189 12.0783C19.2502 11.3752 19.0001 10.5491 19.0001 9.7041Z" stroke="currentColor" stroke-width="1.5"></path><path opacity="0.5" d="M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></div><span class="ltr:mr-3 rtl:ml-3">Documentation: </span><a href="https://www.npmjs.com/package/swiper" target="_blank" class="block hover:underline">https://www.npmjs.com/package/swiper</a></div>',1)),t("div",ce,[t("div",we,[t("div",ge,[r[6]||(r[6]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Basic",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:r[0]||(r[0]=o=>s(d)("code1"))},r[5]||(r[5]=[S('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),(a(),p(s(_),{modules:[s(N),s(A)],navigation:{nextEl:".swiper-button-next-ex1",prevEl:".swiper-button-prev-ex1"},pagination:{clickable:!0},class:"mx-auto mb-5 max-w-3xl",id:"slider1",dir:s(e).rtlClass,key:s(e).rtlClass==="rtl"?"true":"false"},{default:l(()=>[(a(!0),k(M,null,T(n.value,(o,u)=>(a(),p(s(v),{key:u},{default:l(()=>[t("img",{src:`/assets/images/${o}`,class:"max-h-80 w-full object-cover",alt:""},null,8,ve)]),_:2},1024))),128)),r[7]||(r[7]=t("a",{href:"javascript:;",class:"swiper-button-prev-ex1 absolute top-1/2 z-[999] grid -translate-y-1/2 place-content-center rounded-full border border-primary p-1 text-primary transition hover:border-primary hover:bg-primary hover:text-white ltr:left-2 rtl:right-2"},[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 rtl:rotate-180"},[t("path",{d:"M15 5L9 12L15 19",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"})])],-1)),r[8]||(r[8]=t("a",{href:"javascript:;",class:"swiper-button-next-ex1 absolute top-1/2 z-[999] grid -translate-y-1/2 place-content-center rounded-full border border-primary p-1 text-primary transition hover:border-primary hover:bg-primary hover:text-white ltr:right-2 rtl:left-2"},[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 ltr:rotate-180"},[t("path",{d:"M15 5L9 12L15 19",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"})])],-1))]),_:1,__:[7,8]},8,["modules","dir"])),s(f).includes("code1")?(a(),p(B,{key:0},{default:l(()=>r[9]||(r[9]=[t("pre",null,`<!-- basic -->
<Swiper
  :modules="[Navigation, Pagination]"
  :navigation="{ nextEl: '.swiper-button-next-ex1', prevEl: '.swiper-button-prev-ex1' }"
  :pagination="{ clickable: true }"
  class="max-w-3xl mx-auto mb-5"
  id="slider1"
>
  <template v-for="(item, i) in items" :key="i">
    <SwiperSlide>
      <img :src="\`/assets/images/\${item}\`" class="w-full max-h-80 object-cover" alt="" />
    </SwiperSlide>
  </template>
  <a
    href="javascript:;"
    class="
      swiper-button-prev-ex1
      grid
      place-content-center
      ltr:left-2
      rtl:right-2
      p-1
      transition
      text-primary
      hover:text-white
      border border-primary
      hover:border-primary hover:bg-primary
      rounded-full
      absolute
      z-[999]
      top-1/2
      -translate-y-1/2
    "
  >
    <svg> ... </svg>
  </a>
  <a
    href="javascript:;"
    class="
      swiper-button-next-ex1
      grid
      place-content-center
      ltr:right-2
      rtl:left-2
      p-1
      transition
      text-primary
      hover:text-white
      border border-primary
      hover:border-primary hover:bg-primary
      rounded-full
      absolute
      z-[999]
      top-1/2
      -translate-y-1/2
    "
  >
    <svg> ... </svg>
  </a>
</Swiper>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
const items = ref(['carousel1.jpeg', 'carousel2.jpeg', 'carousel3.jpeg']);
<\/script>
`,-1)])),_:1,__:[9]})):E("",!0)]),t("div",fe,[t("div",ye,[r[11]||(r[11]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Autopaly",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:r[1]||(r[1]=o=>s(d)("code2"))},r[10]||(r[10]=[S('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),(a(),p(s(_),{modules:[s(N),s(W)],navigation:{nextEl:".swiper-button-next-ex2",prevEl:".swiper-button-prev-ex2"},autoplay:{delay:2e3},class:"mx-auto mb-5 max-w-3xl",id:"slider2",dir:s(e).rtlClass,key:s(e).rtlClass==="rtl"?"true":"false"},{default:l(()=>[(a(!0),k(M,null,T(n.value,(o,u)=>(a(),p(s(v),{key:u},{default:l(()=>[t("img",{src:`/assets/images/${o}`,class:"max-h-80 w-full object-cover",alt:""},null,8,he),r[12]||(r[12]=t("div",{class:"absolute top-1/4 z-[999] text-white ltr:left-12 rtl:right-12"},[t("div",{class:"text-base font-bold sm:text-3xl"},"This is blog Image"),t("div",{class:"mt-1 hidden w-4/5 text-base font-medium sm:mt-5 sm:block"}," Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard. "),t("button",{type:"button",class:"btn btn-primary mt-4"},"Learn more")],-1))]),_:2,__:[12]},1024))),128)),r[13]||(r[13]=t("a",{href:"javascript:;",class:"swiper-button-prev-ex2 absolute top-1/2 z-[999] grid -translate-y-1/2 place-content-center rounded-full border border-primary p-1 text-primary transition hover:border-primary hover:bg-primary hover:text-white ltr:left-2 rtl:right-2"},[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 rtl:rotate-180"},[t("path",{d:"M15 5L9 12L15 19",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"})])],-1)),r[14]||(r[14]=t("a",{href:"javascript:;",class:"swiper-button-next-ex2 absolute top-1/2 z-[999] grid -translate-y-1/2 place-content-center rounded-full border border-primary p-1 text-primary transition hover:border-primary hover:bg-primary hover:text-white ltr:right-2 rtl:left-2"},[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 ltr:rotate-180"},[t("path",{d:"M15 5L9 12L15 19",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"})])],-1))]),_:1,__:[13,14]},8,["modules","dir"])),s(f).includes("code2")?(a(),p(B,{key:0},{default:l(()=>r[15]||(r[15]=[t("pre",null,`<!-- autopaly -->
<Swiper
  :modules="[Navigation, Autoplay]"
  :navigation="{ nextEl: '.swiper-button-next-ex2', prevEl: '.swiper-button-prev-ex2' }"
  :autoplay="{ delay: 2000 }"
  class="max-w-3xl mx-auto mb-5"
  id="slider2"
>
  <template v-for="(item, i) in items" :key="i">
    <SwiperSlide>
      <img :src="\`/assets/images/\${item}\`" class="w-full max-h-80 object-cover" alt="" />
      <div class="absolute z-[999] text-white top-1/4 ltr:left-12 rtl:right-12">
        <div class="sm:text-3xl text-base font-bold">This is blog Image</div>
        <div class="sm:mt-5 mt-1 w-4/5 text-base sm:block hidden font-medium">
          Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard.
        </div>
        <button type="button" class="mt-4 btn btn-primary">Learn more</button>
      </div>
    </SwiperSlide>
  </template>
  <a
    href="javascript:;"
    class="
      swiper-button-prev-ex2
      grid
      place-content-center
      ltr:left-2
      rtl:right-2
      p-1
      transition
      text-primary
      hover:text-white
      border border-primary
      hover:border-primary hover:bg-primary
      rounded-full
      absolute
      z-[999]
      top-1/2
      -translate-y-1/2
    "
  >
    <svg> ... </svg>
  </a>
  <a
    href="javascript:;"
    class="
      swiper-button-next-ex2
      grid
      place-content-center
      ltr:right-2
      rtl:left-2
      p-1
      transition
      text-primary
      hover:text-white
      border border-primary
      hover:border-primary hover:bg-primary
      rounded-full
      absolute
      z-[999]
      top-1/2
      -translate-y-1/2
    "
  >
    <svg> ... </svg>
  </a>
</Swiper>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
const items = ref(['carousel1.jpeg', 'carousel2.jpeg', 'carousel3.jpeg']);
<\/script>
`,-1)])),_:1,__:[15]})):E("",!0)]),t("div",xe,[t("div",be,[r[17]||(r[17]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Vertical",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:r[2]||(r[2]=o=>s(d)("code3"))},r[16]||(r[16]=[S('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),(a(),p(s(_),{modules:[s(A),s(W)],direction:"vertical",pagination:{clickable:!0},autoplay:{delay:2e3},class:"mx-auto mb-5 max-w-3xl",id:"slider3",dir:s(e).rtlClass,key:s(e).rtlClass==="rtl"?"true":"false"},{default:l(()=>[(a(!0),k(M,null,T(n.value,(o,u)=>(a(),p(s(v),{key:u},{default:l(()=>[t("img",{src:`/assets/images/${o}`,class:"w-full",alt:""},null,8,ke),r[18]||(r[18]=t("div",{class:"absolute top-1/2 left-1/2 z-[999] w-full -translate-x-1/2 text-center text-white"},[t("div",{class:"text-base font-medium sm:text-xl"},"Lorem Ipsum is simply dummy text of the printing.")],-1))]),_:2,__:[18]},1024))),128))]),_:1},8,["modules","dir"])),s(f).includes("code3")?(a(),p(B,{key:0},{default:l(()=>r[19]||(r[19]=[t("pre",null,`<!-- vertical -->
<Swiper :modules="[Pagination, Autoplay]" :direction="'vertical'" :pagination="{ clickable: true }" :autoplay="{ delay: 2000 }" class="max-w-3xl mx-auto mb-5" id="slider3">
  <template v-for="(item, i) in items" :key="i">
    <SwiperSlide>
      <img :src="\`/assets/images/\${item}\`" class="w-full" alt="" />
      <div class="absolute z-[999] text-white top-1/2 left-1/2 w-full -translate-x-1/2 text-center">
        <div class="sm:text-xl text-base font-medium">Lorem Ipsum is simply dummy text of the printing.</div>
      </div>
    </SwiperSlide>
  </template>
</Swiper>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
const items = ref(['carousel1.jpeg', 'carousel2.jpeg', 'carousel3.jpeg']);
<\/script>
`,-1)])),_:1,__:[19]})):E("",!0)]),t("div",Se,[t("div",Ce,[r[21]||(r[21]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Loop",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:r[3]||(r[3]=o=>s(d)("code4"))},r[20]||(r[20]=[S('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),(a(),p(s(_),{modules:[s(N),s(A)],slidesPerView:"auto",spaceBetween:30,loop:!0,navigation:{nextEl:".swiper-button-next-ex4",prevEl:".swiper-button-prev-ex4"},pagination:{clickable:!0,type:"fraction"},class:"mx-auto mb-5 max-w-3xl",id:"slider4",dir:s(e).rtlClass,key:s(e).rtlClass==="rtl"?"true":"false"},{default:l(()=>[O(s(v),null,{default:l(()=>r[22]||(r[22]=[t("img",{src:ie,class:"w-full",alt:""},null,-1),t("div",{class:"absolute bottom-8 left-1/2 z-[999] w-full -translate-x-1/2 px-11 text-center text-white sm:px-0"},[t("div",{class:"text-3xl font-bold"},"Slide 1"),t("div",{class:"mb-4 font-medium sm:text-base"},"Lorem Ipsum is simply dummy text of the printing.")],-1)])),_:1,__:[22]}),O(s(v),null,{default:l(()=>r[23]||(r[23]=[t("img",{src:de,class:"w-full",alt:""},null,-1),t("div",{class:"absolute bottom-8 left-1/2 z-[999] w-full -translate-x-1/2 px-11 text-center text-white sm:px-0"},[t("div",{class:"text-3xl font-bold"},"Slide 2"),t("div",{class:"mb-4 font-medium sm:text-base"},"Lorem Ipsum is simply dummy text of the printing.")],-1)])),_:1,__:[23]}),O(s(v),null,{default:l(()=>r[24]||(r[24]=[t("img",{src:ue,class:"w-full",alt:""},null,-1),t("div",{class:"absolute bottom-8 left-1/2 z-[999] w-full -translate-x-1/2 px-11 text-center text-white sm:px-0"},[t("div",{class:"text-3xl font-bold"},"Slide 3"),t("div",{class:"mb-4 font-medium sm:text-base"},"Lorem Ipsum is simply dummy text of the printing.")],-1)])),_:1,__:[24]}),r[25]||(r[25]=t("a",{href:"javascript:;",class:"swiper-button-prev-ex4 absolute top-1/2 z-[999] grid -translate-y-1/2 place-content-center rounded-full border border-primary p-1 text-primary transition hover:border-primary hover:bg-primary hover:text-white ltr:left-2 rtl:right-2"},[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 rtl:rotate-180"},[t("path",{d:"M15 5L9 12L15 19",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"})])],-1)),r[26]||(r[26]=t("a",{href:"javascript:;",class:"swiper-button-next-ex4 absolute top-1/2 z-[999] grid -translate-y-1/2 place-content-center rounded-full border border-primary p-1 text-primary transition hover:border-primary hover:bg-primary hover:text-white ltr:right-2 rtl:left-2"},[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 ltr:rotate-180"},[t("path",{d:"M15 5L9 12L15 19",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"})])],-1))]),_:1,__:[25,26]},8,["modules","dir"])),s(f).includes("code4")?(a(),p(B,{key:0},{default:l(()=>r[27]||(r[27]=[t("pre",null,`<!-- loop -->
<Swiper
  :modules="[Navigation, Pagination]"
  slidesPerView="auto"
  :spaceBetween="30"
  :loop="true"
  :navigation="{ nextEl: '.swiper-button-next-ex4', prevEl: '.swiper-button-prev-ex4' }"
  :pagination="{ clickable: true, type: 'fraction' }"
  class="max-w-3xl mx-auto mb-5"
  id="slider4"
>
  <SwiperSlide>
    <img src="/assets/images/carousel1.jpeg" class="w-full" alt="" />
    <div class="absolute z-[999] text-white bottom-8 left-1/2 w-full -translate-x-1/2 text-center sm:px-0 px-11">
      <div class="text-3xl font-bold">Slide 1</div>
      <div class="mb-4 sm:text-base font-medium">Lorem Ipsum is simply dummy text of the printing.</div>
    </div>
  </SwiperSlide>
  <SwiperSlide>
    <img src="/assets/images/carousel2.jpeg" class="w-full" alt="" />
    <div class="absolute z-[999] text-white bottom-8 left-1/2 w-full -translate-x-1/2 text-center sm:px-0 px-11">
      <div class="text-3xl font-bold">Slide 2</div>
      <div class="mb-4 sm:text-base font-medium">Lorem Ipsum is simply dummy text of the printing.</div>
    </div>
  </SwiperSlide>
  <SwiperSlide>
    <img src="/assets/images/carousel3.jpeg" class="w-full" alt="" />
    <div class="absolute z-[999] text-white bottom-8 left-1/2 w-full -translate-x-1/2 text-center sm:px-0 px-11">
      <div class="text-3xl font-bold">Slide 3</div>
      <div class="mb-4 sm:text-base font-medium">Lorem Ipsum is simply dummy text of the printing.</div>
    </div>
  </SwiperSlide>
  <a
    href="javascript:;"
    class="
      swiper-button-prev-ex4
      grid
      place-content-center
      ltr:left-2
      rtl:right-2
      p-1
      transition
      text-primary
      hover:text-white
      border border-primary
      hover:border-primary hover:bg-primary
      rounded-full
      absolute
      z-[999]
      top-1/2
      -translate-y-1/2
    "
  >
    <svg> ... </svg>
  </a>
  <a
    href="javascript:;"
    class="
      swiper-button-next-ex4
      grid
      place-content-center
      ltr:right-2
      rtl:left-2
      p-1
      transition
      text-primary
      hover:text-white
      border border-primary
      hover:border-primary hover:bg-primary
      rounded-full
      absolute
      z-[999]
      top-1/2
      -translate-y-1/2
    "
  >
    <svg> ... </svg>
  </a>
</Swiper>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
const items = ref(['carousel1.jpeg', 'carousel2.jpeg', 'carousel3.jpeg']);
<\/script>
`,-1)])),_:1,__:[27]})):E("",!0)]),t("div",Le,[t("div",je,[r[29]||(r[29]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Multiple Slides",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:r[4]||(r[4]=o=>s(d)("code5"))},r[28]||(r[28]=[S('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),(a(),p(s(_),{modules:[s(N),s(A)],navigation:{nextEl:".swiper-button-next-ex5",prevEl:".swiper-button-prev-ex5"},pagination:{clickable:!0},breakpoints:{1024:{slidesPerView:3,spaceBetween:30},768:{slidesPerView:2,spaceBetween:40},320:{slidesPerView:1,spaceBetween:20}},id:"slider5",dir:s(e).rtlClass,key:s(e).rtlClass==="rtl"?"true":"false"},{default:l(()=>[(a(!0),k(M,null,T(n.value,(o,u)=>(a(),p(s(v),{key:u},{default:l(()=>[t("img",{src:`/assets/images/${o}`,class:"w-full",alt:""},null,8,Ee)]),_:2},1024))),128)),(a(!0),k(M,null,T(n.value,(o,u)=>(a(),p(s(v),{key:u},{default:l(()=>[t("img",{src:`/assets/images/${o}`,class:"w-full",alt:""},null,8,Me)]),_:2},1024))),128)),r[30]||(r[30]=t("a",{href:"javascript:;",class:"swiper-button-prev-ex5 absolute top-[44%] z-[999] grid -translate-y-1/2 place-content-center rounded-full border border-primary p-1 text-primary transition hover:border-primary hover:bg-primary hover:text-white ltr:left-2 rtl:right-2"},[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 rtl:rotate-180"},[t("path",{d:"M15 5L9 12L15 19",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"})])],-1)),r[31]||(r[31]=t("a",{href:"javascript:;",class:"swiper-button-next-ex5 absolute top-[44%] z-[999] grid -translate-y-1/2 place-content-center rounded-full border border-primary p-1 text-primary transition hover:border-primary hover:bg-primary hover:text-white ltr:right-2 rtl:left-2"},[t("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"h-5 w-5 ltr:rotate-180"},[t("path",{d:"M15 5L9 12L15 19",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"})])],-1))]),_:1,__:[30,31]},8,["modules","dir"])),s(f).includes("code5")?(a(),p(B,{key:0},{default:l(()=>r[32]||(r[32]=[t("pre",null,`<!-- multiple -->
<Swiper
  :modules="[Navigation, Pagination]"
  :navigation="{ nextEl: '.swiper-button-next-ex5', prevEl: '.swiper-button-prev-ex5' }"
  :pagination="{ clickable: true }"
  :breakpoints="{ 1024: { slidesPerView: 3, spaceBetween: 30 }, 768: { slidesPerView: 2, spaceBetween: 40 }, 320: { slidesPerView: 1, spaceBetween: 20 } }"
  id="slider5"
>
  <template v-for="(item, i) in items" :key="i">
    <SwiperSlide>
      <img :src="\`/assets/images/\${item}\`" class="w-full" alt="" />
    </SwiperSlide>
  </template>
  <template v-for="(item, i) in items" :key="i">
    <SwiperSlide>
      <img :src="\`/assets/images/\${item}\`" class="w-full" alt="" />
    </SwiperSlide>
  </template>
  <a
    href="javascript:;"
    class="
      swiper-button-prev-ex5
      grid
      place-content-center
      ltr:left-2
      rtl:right-2
      p-1
      transition
      text-primary
      hover:text-white
      border border-primary
      hover:border-primary hover:bg-primary
      rounded-full
      absolute
      z-[999]
      top-[44%]
      -translate-y-1/2
    "
  >
    <svg> ... </svg>
  </a>
  <a
    href="javascript:;"
    class="
      swiper-button-next-ex5
      grid
      place-content-center
      ltr:right-2
      rtl:left-2
      p-1
      transition
      text-primary
      hover:text-white
      border border-primary
      hover:border-primary hover:bg-primary
      rounded-full
      absolute
      z-[999]
      top-[44%]
      -translate-y-1/2
    "
  >
    <svg> ... </svg>
  </a>
</Swiper>

<!-- script -->
<script lang="ts" setup>
import { ref } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
const items = ref(['carousel1.jpeg', 'carousel2.jpeg', 'carousel3.jpeg']);
<\/script>
`,-1)])),_:1,__:[32]})):E("",!0)])])])]))}});export{Ne as default};
