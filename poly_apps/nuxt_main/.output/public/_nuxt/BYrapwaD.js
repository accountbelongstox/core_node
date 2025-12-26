import{c as y,h as p}from"./Bykx_eDL.js";import{d as D,u as M,r as n,o as C,W as f,h as j,k as e,c as b,s as v,v as x,q as w,t as d,b as _,g as i}from"./Cs8kveBG.js";import"./92s3wAHG.js";const T={class:"grid grid-cols-1 gap-6 pt-5 xl:grid-cols-2"},L={class:"panel"},I={class:"mb-5 flex items-center justify-between"},S={class:"mb-5 grid grid-cols-4 justify-items-center gap-3"},B={class:"flex h-16 w-16 flex-col justify-center rounded border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"},H={class:"text-center text-xl text-primary sm:text-3xl"},F={class:"flex h-16 w-16 flex-col justify-center rounded border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"},Y={class:"text-center text-xl text-primary sm:text-3xl"},N={class:"flex h-16 w-16 flex-col justify-center rounded border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"},V={class:"text-center text-xl text-primary sm:text-3xl"},$={class:"flex h-16 w-16 flex-col justify-center rounded border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"},q={class:"text-center text-xl text-primary sm:text-3xl"},A={class:"panel"},E={class:"mb-5 flex items-center justify-between"},P={class:"mb-5 grid grid-cols-4 justify-items-center gap-3"},W={class:"flex h-16 w-16 flex-col justify-center rounded-full border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"},z={class:"text-center text-xl text-primary sm:text-3xl"},G={class:"flex h-16 w-16 flex-col justify-center rounded-full border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"},J={class:"text-center text-xl text-primary sm:text-3xl"},K={class:"flex h-16 w-16 flex-col justify-center rounded-full border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"},O={class:"text-center text-xl text-primary sm:text-3xl"},Q={class:"flex h-16 w-16 flex-col justify-center rounded-full border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"},R={class:"text-center text-xl text-primary sm:text-3xl"},te=D({__name:"countdown",setup(U){M({title:"Countdown"});const{codeArr:c,toggleCode:m}=y(),u=n(null),r=n({days:null,hours:null,minutes:null,seconds:null}),h=n(null),o=n({days:null,hours:null,minutes:null,seconds:null});C(()=>{k(),g()});const k=()=>{let l=new Date;l.setDate(l.getDate()+3);let t=l.getTime();u.value=f(()=>{let a=new Date().getTime(),s=t-a;r.value.days=Math.floor(s/(1e3*60*60*24)),r.value.hours=Math.floor(s%(1e3*60*60*24)/(1e3*60*60)),r.value.minutes=Math.floor(s%(1e3*60*60)/(1e3*60)),r.value.seconds=Math.floor(s%(1e3*60)/1e3),s<0&&clearInterval(u.value)},500)},g=()=>{let l=new Date;l.setFullYear(l.getFullYear()+1);let t=l.getTime();h.value=f(()=>{let a=new Date().getTime(),s=t-a;o.value.days=Math.floor(s/(1e3*60*60*24)),o.value.hours=Math.floor(s%(1e3*60*60*24)/(1e3*60*60)),o.value.minutes=Math.floor(s%(1e3*60*60)/(1e3*60)),o.value.seconds=Math.floor(s%(1e3*60)/1e3),s<0&&clearInterval(h.value)},500)};return(l,t)=>(i(),j("div",null,[t[16]||(t[16]=e("ul",{class:"flex space-x-2 rtl:space-x-reverse"},[e("li",null,[e("a",{href:"javascript:;",class:"text-primary hover:underline"},"Components")]),e("li",{class:"before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"},[e("span",null,"Countdown")])],-1)),e("div",T,[e("div",L,[e("div",I,[t[3]||(t[3]=e("h5",{class:"text-lg font-semibold dark:text-white-light"},"Simple Countdown",-1)),e("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[0]||(t[0]=a=>x(m)("code1"))},t[2]||(t[2]=[w('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e("div",S,[e("div",null,[e("div",B,[e("h1",H,d(r.value.days),1)]),t[4]||(t[4]=e("h4",{class:"mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark"},"Days",-1))]),e("div",null,[e("div",F,[e("h1",Y,d(r.value.hours),1)]),t[5]||(t[5]=e("h4",{class:"mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark"},"Hours",-1))]),e("div",null,[e("div",N,[e("h1",V,d(r.value.minutes),1)]),t[6]||(t[6]=e("h4",{class:"mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark"},"Mins",-1))]),e("div",null,[e("div",$,[e("h1",q,d(r.value.seconds),1)]),t[7]||(t[7]=e("h4",{class:"mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark"},"Sec",-1))])]),x(c).includes("code1")?(i(),b(p,{key:0},{default:_(()=>t[8]||(t[8]=[e("pre",null,`<!-- simple countdown -->
    <div class="mb-5 grid grid-cols-4 justify-items-center gap-3">
        <div>
            <div
                class="flex h-16 w-16 flex-col justify-center rounded border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"
            >
                <h1 class="text-center text-xl text-primary sm:text-3xl">{{ demo1.days }}</h1>
            </div>
            <h4 class="mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark">Days</h4>
        </div>
        <div>
            <div
                class="flex h-16 w-16 flex-col justify-center rounded border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"
            >
                <h1 class="text-center text-xl text-primary sm:text-3xl">{{ demo1.hours }}</h1>
            </div>
            <h4 class="mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark">Hours</h4>
        </div>
        <div>
            <div
                class="flex h-16 w-16 flex-col justify-center rounded border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"
            >
                <h1 class="text-center text-xl text-primary sm:text-3xl">{{ demo1.minutes }}</h1>
            </div>
            <h4 class="mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark">Mins</h4>
        </div>
        <div>
            <div
                class="flex h-16 w-16 flex-col justify-center rounded border border-[#e0e6ed] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] dark:border-[#1b2e4b] sm:h-[100px] sm:w-[100px]"
            >
                <h1 class="text-center text-xl text-primary sm:text-3xl">{{ demo1.seconds }}</h1>
            </div>
            <h4 class="mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark">Sec</h4>
        </div>
    </div>

<!-- script -->
<script lang="ts" setup>
    import { ref, onMounted } from 'vue';
    const timer1: any = ref(null);
    const demo1: any = ref({
        days: null,
        hours: null,
        minutes: null,
        seconds: null,
    });
    onMounted(() => {
        setTimerDemo1();
    });

    const setTimerDemo1 = () => {
        let date = new Date();
        date.setDate(date.getDate() + 3);
        let countDownDate = date.getTime();

        timer1.value = setInterval(() => {
            let now = new Date().getTime();

            let distance = countDownDate - now;

            demo1.value.days = Math.floor(distance / (1000 * 60 * 60 * 24));
            demo1.value.hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            demo1.value.minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            demo1.value.seconds = Math.floor((distance % (1000 * 60)) / 1000);

            if (distance < 0) {
                clearInterval(timer1.value);
            }
        }, 500);
    };
<\/script>
`,-1)])),_:1,__:[8]})):v("",!0)]),e("div",A,[e("div",E,[t[10]||(t[10]=e("h5",{class:"text-lg font-semibold dark:text-white-light"},"Circle Countdown",-1)),e("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:t[1]||(t[1]=a=>x(m)("code2"))},t[9]||(t[9]=[w('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e("div",P,[e("div",null,[e("div",W,[e("h1",z,d(o.value.days),1)]),t[11]||(t[11]=e("h4",{class:"mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark"},"Days",-1))]),e("div",null,[e("div",G,[e("h1",J,d(o.value.hours),1)]),t[12]||(t[12]=e("h4",{class:"mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark"},"Hours",-1))]),e("div",null,[e("div",K,[e("h1",O,d(o.value.minutes),1)]),t[13]||(t[13]=e("h4",{class:"mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark"},"Mins",-1))]),e("div",null,[e("div",Q,[e("h1",R,d(o.value.seconds),1)]),t[14]||(t[14]=e("h4",{class:"mt-4 text-center text-[15px] font-semibold text-[#3b3f5c] dark:text-white-dark"},"Sec",-1))])]),x(c).includes("code2")?(i(),b(p,{key:0},{default:_(()=>t[15]||(t[15]=[e("pre",null,`<!-- circle countdown -->
<div class="mb-5 grid grid-cols-4 justify-items-center gap-3">
  <div>
    <div class="w-16 h-16 sm:w-[100px] sm:h-[100px] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] rounded-full border border-[#e0e6ed] dark:border-[#1b2e4b] flex justify-center flex-col">
      <h1 class="text-primary sm:text-3xl text-xl text-center">{{ demo2.days }}</h1>
    </div>
    <h4 class="text-[#3b3f5c] text-[15px] mt-4 text-center dark:text-white-dark font-semibold">Days</h4>
  </div>
  <div>
    <div class="w-16 h-16 sm:w-[100px] sm:h-[100px] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] rounded-full border border-[#e0e6ed] dark:border-[#1b2e4b] flex justify-center flex-col">
      <h1 class="text-primary sm:text-3xl text-xl text-center">{{ demo2.hours }}</h1>
    </div>
    <h4 class="text-[#3b3f5c] text-[15px] mt-4 text-center dark:text-white-dark font-semibold">Hours</h4>
  </div>
  <div>
    <div class="w-16 h-16 sm:w-[100px] sm:h-[100px] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] rounded-full border border-[#e0e6ed] dark:border-[#1b2e4b] flex justify-center flex-col">
      <h1 class="text-primary sm:text-3xl text-xl text-center">{{ demo2.minutes }}</h1>
    </div>
    <h4 class="text-[#3b3f5c] text-[15px] mt-4 text-center dark:text-white-dark font-semibold">Mins</h4>
  </div>
  <div>
    <div class="w-16 h-16 sm:w-[100px] sm:h-[100px] shadow-[1px_2px_12px_0_rgba(31,45,61,0.10)] rounded-full border border-[#e0e6ed] dark:border-[#1b2e4b] flex justify-center flex-col">
      <h1 class="text-primary sm:text-3xl text-xl text-center">{{ demo2.seconds }}</h1>
    </div>
    <h4 class="text-[#3b3f5c] text-[15px] mt-4 text-center dark:text-white-dark font-semibold">Sec</h4>
  </div>
</div>
<!-- script -->
<script lang="ts" setup>
import { ref, onMounted } from 'vue';
const timer2: any = ref(null);
const demo2: any = ref({
  days: null,
  hours: null,
  minutes: null,
  seconds: null,
});

onMounted(() => {
  setTimerDemo2();
});

const setTimerDemo2 = () => {
  let date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  let countDownDate = date.getTime();

  timer2.value = setInterval(() => {
    let now = new Date().getTime();

    let distance = countDownDate - now;

    demo2.value.days = Math.floor(distance / (1000 * 60 * 60 * 24));
    demo2.value.hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    demo2.value.minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    demo2.value.seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if (distance < 0) {
      clearInterval(timer2.value);
    }
  }, 500);
};
<\/script>
`,-1)])),_:1,__:[15]})):v("",!0)])])]))}});export{te as default};
