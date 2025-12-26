import{d as Y,u as I,o as q,m as H,p as m,r as f,h as Z,k as t,q as p,c as k,s as b,v as o,l as a,b as l,x as K,y as Q,g as h}from"./Cs8kveBG.js";import{c as ee,h as g}from"./Bykx_eDL.js";import{u as te}from"./CPc_GOQr.js";import"./92s3wAHG.js";const re={class:"grid grid-cols-1 gap-6 lg:grid-cols-2"},se={class:"panel"},oe={class:"mb-5 flex items-center justify-between"},ae={class:"mb-5"},le={class:"panel"},ie={class:"mb-5 flex items-center justify-between"},ne={class:"mb-5"},de={class:"panel"},pe={class:"mb-5 flex items-center justify-between"},he={class:"mb-5"},ce={class:"panel"},ue={class:"mb-5 flex items-center justify-between"},me={class:"mb-5"},fe={class:"panel"},ke={class:"mb-5 flex items-center justify-between"},be={class:"mb-5"},ge={class:"panel"},xe={class:"mb-5 flex items-center justify-between"},we={class:"mb-5"},Ce={class:"panel"},ve={class:"mb-5 flex items-center justify-between"},ye={class:"mb-5"},Me={class:"panel"},Se={class:"mb-5 flex items-center justify-between"},Le={class:"mb-5"},Ae={class:"panel"},De={class:"mb-5 flex items-center justify-between"},Be={class:"mb-5"},Te={class:"panel"},ze={class:"mb-5 flex items-center justify-between"},_e={class:"mb-5"},Re={class:"panel"},je={class:"mb-5 flex items-center justify-between"},Oe={class:"mb-5"},Je={class:"panel"},Fe={class:"mb-5 flex items-center justify-between"},Ge={class:"mb-5"},Ve=Y({__name:"charts",setup(Xe){I({title:"Charts"});const i=te(),{codeArr:c,toggleCode:u}=ee();q(()=>{H(()=>{window.dispatchEvent(new Event("resize"))})});const x=(r,e,s)=>{for(var n=0,d=[];n<e;){var V=Math.floor(Math.random()*750)+1,W=Math.floor(Math.random()*(s.max-s.min+1))+s.min,U=Math.floor(Math.random()*61)+15;d.push([V,W,U]),n++}return d},w=m(()=>{const r=i.theme==="dark",e=i.rtlClass==="rtl";return{chart:{height:300,type:"line",toolbar:!1},colors:["#4361ee"],tooltip:{marker:!1,y:{formatter(s){return"$"+s}},theme:r?"dark":"light"},stroke:{width:2,curve:"smooth"},xaxis:{categories:["Jan","Feb","Mar","Apr","May","June"],axisBorder:{color:r?"#191e3a":"#e0e6ed"}},yaxis:{opposite:!!e,labels:{offsetX:e?-20:0}},grid:{borderColor:r?"#191e3a":"#e0e6ed"}}}),C=f([{name:"Sales",data:[45,55,75,25,45,110]}]),v=m(()=>{const r=i.theme==="dark",e=i.rtlClass==="rtl";return{chart:{type:"area",height:300,zoom:{enabled:!1},toolbar:{show:!1}},colors:["#805dca"],dataLabels:{enabled:!1},stroke:{width:2,curve:"smooth"},xaxis:{axisBorder:{color:r?"#191e3a":"#e0e6ed"}},yaxis:{opposite:!!e,labels:{offsetX:e?-40:0}},labels:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],legend:{horizontalAlign:"left"},grid:{borderColor:r?"#191e3a":"#e0e6ed"},tooltip:{theme:r?"dark":"light"}}}),y=f([{name:"Income",data:[16800,16800,15500,17800,15500,17e3,19e3,16e3,15e3,17e3,14e3,17e3]}]),M=m(()=>{const r=i.theme==="dark",e=i.rtlClass==="rtl";return{chart:{height:300,type:"bar",zoom:{enabled:!1},toolbar:{show:!1}},colors:["#805dca","#e7515a"],dataLabels:{enabled:!1},stroke:{show:!0,width:2,colors:["transparent"]},plotOptions:{bar:{horizontal:!1,columnWidth:"55%",endingShape:"rounded"}},grid:{borderColor:r?"#191e3a":"#e0e6ed"},xaxis:{categories:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct"],axisBorder:{color:r?"#191e3a":"#e0e6ed"}},yaxis:{opposite:!!e,labels:{offsetX:e?-10:0}},tooltip:{theme:r?"dark":"light",y:{formatter:function(s){return s}}}}}),S=f([{name:"Net Profit",data:[44,55,57,56,61,58,63,60,66]},{name:"Revenue",data:[76,85,101,98,87,105,91,114,94]}]),L=m(()=>{const r=i.theme==="dark",e=i.rtlClass==="rtl";return{chart:{height:300,type:"bar",stacked:!0,zoom:{enabled:!1},toolbar:{show:!1}},colors:["#2196f3","#3b3f5c"],responsive:[{breakpoint:480,options:{legend:{position:"bottom",offsetX:-10,offsetY:5}}}],plotOptions:{bar:{horizontal:!1}},xaxis:{type:"datetime",categories:["01/01/2011 GMT","01/02/2011 GMT","01/03/2011 GMT","01/04/2011 GMT","01/05/2011 GMT","01/06/2011 GMT"],axisBorder:{color:r?"#191e3a":"#e0e6ed"}},yaxis:{opposite:!!e,labels:{offsetX:e?-20:0}},grid:{borderColor:r?"#191e3a":"#e0e6ed"},legend:{position:"right",offsetY:40},tooltip:{theme:r?"dark":"light"},fill:{opacity:.8}}}),A=f([{name:"PRODUCT A",data:[44,55,41,67,22,43]},{name:"PRODUCT B",data:[13,23,20,8,13,27]}]),D=m(()=>{const r=i.theme==="dark",e=i.rtlClass==="rtl";return{chart:{height:300,type:"bar",zoom:{enabled:!1},toolbar:{show:!1}},dataLabels:{enabled:!1},stroke:{show:!0,width:1},colors:["#4361ee"],xaxis:{categories:["Sun","Mon","Tue","Wed","Thur","Fri","Sat"],axisBorder:{color:r?"#191e3a":"#e0e6ed"}},yaxis:{opposite:!!e,reversed:!!e},grid:{borderColor:r?"#191e3a":"#e0e6ed"},plotOptions:{bar:{horizontal:!0}},fill:{opacity:.8}}}),B=f([{name:"Sales",data:[44,55,41,67,22,43,21,70]}]),T=m(()=>{const r=i.theme==="dark",e=i.rtlClass==="rtl";return{chart:{height:300,zoom:{enabled:!1},toolbar:{show:!1}},colors:["#2196f3","#00ab55","#4361ee"],stroke:{width:[0,2,2],curve:"smooth"},plotOptions:{bar:{columnWidth:"50%"}},fill:{opacity:[1,.25,1]},labels:["01/01/2022","02/01/2022","03/01/2022","04/01/2022","05/01/2022","06/01/2022","07/01/2022","08/01/2022","09/01/2022","10/01/2022","11/01/2022"],markers:{size:0},xaxis:{type:"datetime",axisBorder:{color:r?"#191e3a":"#e0e6ed"}},yaxis:{title:{text:"Points"},min:0,opposite:!!e,labels:{offsetX:e?-10:0}},grid:{borderColor:r?"#191e3a":"#e0e6ed"},tooltip:{shared:!0,intersect:!1,theme:r?"dark":"light",y:{formatter:s=>typeof s<"u"?s.toFixed(0)+" points":s}},legend:{itemMargin:{horizontal:4,vertical:8}}}}),z=f([{name:"TEAM A",type:"column",data:[23,11,22,27,13,22,37,21,44,22,30]},{name:"TEAM B",type:"area",data:[44,55,41,67,22,43,21,41,56,27,43]},{name:"TEAM C",type:"line",data:[30,25,36,30,45,35,64,52,59,36,39]}]),_=m(()=>{const r=i.theme==="dark";return{chart:{height:300,type:"radar",zoom:{enabled:!1},toolbar:{show:!1}},colors:["#4361ee"],xaxis:{categories:["January","February","March","April","May","June"]},plotOptions:{radar:{polygons:{strokeColors:r?"#191e3a":"#e0e6ed",connectorColors:r?"#191e3a":"#e0e6ed"}}},tooltip:{theme:r?"dark":"light"}}}),R=f([{name:"Series 1",data:[80,50,30,40,100,20]}]),j=m(()=>({chart:{height:300,type:"pie",zoom:{enabled:!1},toolbar:{show:!1}},labels:["Team A","Team B","Team C","Team D","Team E"],colors:["#4361ee","#805dca","#00ab55","#e7515a","#e2a03f"],responsive:[{breakpoint:480,options:{chart:{width:200}}}],stroke:{show:!1},legend:{position:"bottom"}})),O=f([44,55,13,43,22]),J=m(()=>({chart:{height:300,type:"donut",zoom:{enabled:!1},toolbar:{show:!1}},stroke:{show:!1},labels:["Team A","Team B","Team C"],colors:["#4361ee","#805dca","#e2a03f"],responsive:[{breakpoint:480,options:{chart:{width:200}}}],legend:{position:"bottom"}})),F=f([44,55,13]),G=m(()=>{const r=i.theme==="dark";return{chart:{height:300,type:"polarArea",zoom:{enabled:!1},toolbar:{show:!1}},colors:["#4361ee","#805dca","#00ab55","#e7515a","#e2a03f","#2196f3","#3b3f5c"],stroke:{show:!1},responsive:[{breakpoint:480,options:{chart:{width:200}}}],plotOptions:{polarArea:{rings:{strokeColor:r?"#191e3a":"#e0e6ed"},spokes:{connectorColors:r?"#191e3a":"#e0e6ed"}}},legend:{position:"bottom"},fill:{opacity:.85}}}),X=f([14,23,21,17,15,10,12,17,21]),$=m(()=>{const r=i.theme==="dark";return{chart:{height:300,type:"radialBar",zoom:{enabled:!1},toolbar:{show:!1}},colors:["#4361ee","#805dca","#e2a03f"],grid:{borderColor:r?"#191e3a":"#e0e6ed"},plotOptions:{radialBar:{dataLabels:{name:{fontSize:"22px"},value:{fontSize:"16px"},total:{show:!0,label:"Total",formatter:function(e){return 249}}}}},labels:["Apples","Oranges","Bananas"],fill:{opacity:.85}}}),E=f([44,55,41]),P=m(()=>{const r=i.theme==="dark",e=i.rtlClass==="rtl";return{chart:{height:300,type:"bubble",zoom:{enabled:!1},toolbar:{show:!1}},colors:["#4361ee","#00ab55"],dataLabels:{enabled:!1},xaxis:{tickAmount:12,type:"category",axisBorder:{color:r?"#191e3a":"#e0e6ed"}},yaxis:{max:70,opposite:!!e,labels:{offsetX:e?-10:0}},grid:{borderColor:r?"#191e3a":"#e0e6ed"},tooltip:{theme:r?"dark":"light"},stroke:{colors:r?["#191e3a"]:["#e0e6ed"]},fill:{opacity:.85}}}),N=f([{name:"Bubble1",data:x(new Date("11 Feb 2017 GMT").getTime(),20,{min:10,max:60})},{name:"Bubble2",data:x(new Date("11 Feb 2017 GMT").getTime(),20,{min:10,max:60})}]);return(r,e)=>{const s=Q("apexchart"),n=K;return h(),Z("div",null,[e[49]||(e[49]=t("ul",{class:"mb-6 flex space-x-2 rtl:space-x-reverse"},[t("li",null,[t("a",{href:"javascript:;",class:"text-primary hover:underline"},"Dashboard")]),t("li",{class:"before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"},[t("span",null,"Charts")])],-1)),t("div",re,[e[48]||(e[48]=p('<div class="panel flex items-center overflow-x-auto whitespace-nowrap p-3 text-primary lg:col-span-2"><div class="rounded-full bg-primary p-1.5 text-white ring-2 ring-primary/30 ltr:mr-3 rtl:ml-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5"><path d="M19.0001 9.7041V9C19.0001 5.13401 15.8661 2 12.0001 2C8.13407 2 5.00006 5.13401 5.00006 9V9.7041C5.00006 10.5491 4.74995 11.3752 4.28123 12.0783L3.13263 13.8012C2.08349 15.3749 2.88442 17.5139 4.70913 18.0116C9.48258 19.3134 14.5175 19.3134 19.291 18.0116C21.1157 17.5139 21.9166 15.3749 20.8675 13.8012L19.7189 12.0783C19.2502 11.3752 19.0001 10.5491 19.0001 9.7041Z" stroke="currentColor" stroke-width="1.5"></path><path opacity="0.5" d="M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></div><span class="ltr:mr-3 rtl:ml-3">Documentation: </span><a href="https://www.npmjs.com/package/vue3-apexcharts" target="_blank" class="block hover:underline">https://www.npmjs.com/package/vue3-apexcharts</a></div>',1)),t("div",se,[t("div",oe,[e[13]||(e[13]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Simple Line",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[0]||(e[0]=d=>o(u)("code1"))},e[12]||(e[12]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",ae,[a(n,null,{default:l(()=>[a(s,{height:"300",options:w.value,series:C.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code1")?(h(),k(g,{key:0},{default:l(()=>e[14]||(e[14]=[t("pre",null,`<!-- simple line -->
<apexchart height="300" :options="lineChart" :series="lineChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const lineChart = computed(() => {
  const isDark = store.theme === 'dark' ? true : false;
  const isRtl = store.rtlClass === 'rtl' ? true : false;
  return {
    chart: {
      height: 300,
      type: 'line',
      toolbar: false,
    },
    colors: ['#4361ee'],
    tooltip: {
      marker: false,
      y: {
        formatter(number) {
          return '$' + number;
        },
      },
      theme: isDark ? 'dark' : 'light',
    },
    stroke: {
      width: 2,
      curve: 'smooth',
    },
    xaxis: {
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June'],
      axisBorder: {
        color: isDark ? '#191e3a' : '#e0e6ed',
      },
    },
    yaxis: {
      opposite: isRtl ? true : false,
      labels: {
        offsetX: isRtl ? -20 : 0,
      },
    },
    grid: {
      borderColor: isDark ? '#191e3a' : '#e0e6ed',
    },
  };
});

const lineChartSeries = ref([
  {
    name: 'Sales',
    data: [45, 55, 75, 25, 45, 110],
  },
]);
<\/script>
`,-1)])),_:1,__:[14]})):b("",!0)]),t("div",le,[t("div",ie,[e[16]||(e[16]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Simple Area",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[1]||(e[1]=d=>o(u)("code2"))},e[15]||(e[15]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",ne,[a(n,null,{default:l(()=>[a(s,{height:"300",options:v.value,series:y.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code2")?(h(),k(g,{key:0},{default:l(()=>e[17]||(e[17]=[t("pre",null,`<!-- simple area -->
<apexchart height="300" :options="areaChart" :series="areaChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const areaChart = computed(() => {
  const isDark = store.theme === 'dark' ? true : false;
  const isRtl = store.rtlClass === 'rtl' ? true : false;
  return {
    chart: {
      type: 'area',
      height: 300,
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    colors: ['#805dca'],
    dataLabels: {
      enabled: false,
    },
    stroke: {
      width: 2,
      curve: 'smooth',
    },
    xaxis: {
      axisBorder: {
        color: isDark ? '#191e3a' : '#e0e6ed',
      },
    },
    yaxis: {
      opposite: isRtl ? true : false,
      labels: {
        offsetX: isRtl ? -40 : 0,
      },
    },
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    legend: {
      horizontalAlign: 'left',
    },
    grid: {
      borderColor: isDark ? '#191e3a' : '#e0e6ed',
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
    },
  };
});

const areaChartSeries = ref([
  {
    name: 'Income',
    data: [16800, 16800, 15500, 17800, 15500, 17000, 19000, 16000, 15000, 17000, 14000, 17000],
  },
]);
<\/script>
`,-1)])),_:1,__:[17]})):b("",!0)]),t("div",de,[t("div",pe,[e[19]||(e[19]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Simple Column",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[2]||(e[2]=d=>o(u)("code3"))},e[18]||(e[18]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",he,[a(n,null,{default:l(()=>[a(s,{height:"300",options:M.value,series:S.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code3")?(h(),k(g,{key:0},{default:l(()=>e[20]||(e[20]=[t("pre",null,`<!-- simple column -->
<apexchart height="300" :options="columnChart" :series="columnChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const columnChart = computed(() => {
  const isDark = store.theme === 'dark' ? true : false;
  const isRtl = store.rtlClass === 'rtl' ? true : false;
  return {
    chart: {
      height: 300,
      type: 'bar',
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    colors: ['#805dca', '#e7515a'],
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent'],
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        endingShape: 'rounded',
      },
    },
    grid: {
      borderColor: isDark ? '#191e3a' : '#e0e6ed',
    },
    xaxis: {
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
      axisBorder: {
        color: isDark ? '#191e3a' : '#e0e6ed',
      },
    },
    yaxis: {
      opposite: isRtl ? true : false,
      labels: {
        offsetX: isRtl ? -10 : 0,
      },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: function (val) {
          return val;
        },
      },
    },
  };
});

const columnChartSeries = ref([
  {
    name: 'Net Profit',
    data: [44, 55, 57, 56, 61, 58, 63, 60, 66],
  },
  {
    name: 'Revenue',
    data: [76, 85, 101, 98, 87, 105, 91, 114, 94],
  },
]);
<\/script>
`,-1)])),_:1,__:[20]})):b("",!0)]),t("div",ce,[t("div",ue,[e[22]||(e[22]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Simple Column Stacked",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[3]||(e[3]=d=>o(u)("code4"))},e[21]||(e[21]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",me,[a(n,null,{default:l(()=>[a(s,{height:"300",options:L.value,series:A.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code4")?(h(),k(g,{key:0},{default:l(()=>e[23]||(e[23]=[t("pre",null,`<!-- simple column stacked -->
<apexchart height="300" :options="simpleColumnStacked" :series="simpleColumnStackedSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const simpleColumnStacked = computed(() => {
  const isDark = store.theme === 'dark' ? true : false;
  const isRtl = store.rtlClass === 'rtl' ? true : false;
  return {
    chart: {
      height: 300,
      type: 'bar',
      stacked: true,
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    colors: ['#2196f3', '#3b3f5c'],
    responsive: [
      {
        breakpoint: 480,
        options: {
          legend: {
            position: 'bottom',
            offsetX: -10,
            offsetY: 5,
          },
        },
      },
    ],
    plotOptions: {
      bar: {
        horizontal: false,
      },
    },
    xaxis: {
      type: 'datetime',
      categories: ['01/01/2011 GMT', '01/02/2011 GMT', '01/03/2011 GMT', '01/04/2011 GMT', '01/05/2011 GMT', '01/06/2011 GMT'],
      axisBorder: {
        color: isDark ? '#191e3a' : '#e0e6ed',
      },
    },
    yaxis: {
      opposite: isRtl ? true : false,
      labels: {
        offsetX: isRtl ? -20 : 0,
      },
    },
    grid: {
      borderColor: isDark ? '#191e3a' : '#e0e6ed',
    },
    legend: {
      position: 'right',
      offsetY: 40,
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
    },
    fill: {
      opacity: 0.8,
    },
  };
});

const simpleColumnStackedSeries = ref([
  {
    name: 'PRODUCT A',
    data: [44, 55, 41, 67, 22, 43],
  },
  {
    name: 'PRODUCT B',
    data: [13, 23, 20, 8, 13, 27],
  },
]);
<\/script>
`,-1)])),_:1,__:[23]})):b("",!0)]),t("div",fe,[t("div",ke,[e[25]||(e[25]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Simple Bar",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[4]||(e[4]=d=>o(u)("code5"))},e[24]||(e[24]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",be,[a(n,null,{default:l(()=>[a(s,{height:"300",options:D.value,series:B.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code5")?(h(),k(g,{key:0},{default:l(()=>e[26]||(e[26]=[t("pre",null,`<!-- simple bar -->
<apexchart height="300" :options="barChart" :series="barChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const barChart = computed(() => {
  const isDark = store.theme === 'dark' ? true : false;
  const isRtl = store.rtlClass === 'rtl' ? true : false;
  return {
    chart: {
      height: 300,
      type: 'bar',
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 1,
    },
    colors: ['#4361ee'],
    xaxis: {
      categories: ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'],
      axisBorder: {
        color: isDark ? '#191e3a' : '#e0e6ed',
      },
    },
    yaxis: {
      opposite: isRtl ? true : false,
      reversed: isRtl ? true : false,
    },
    grid: {
      borderColor: isDark ? '#191e3a' : '#e0e6ed',
    },
    plotOptions: {
      bar: {
        horizontal: true,
      },
    },
    fill: {
      opacity: 0.8,
    },
  };
});

const barChartSeries = ref([
  {
    name: 'Sales',
    data: [44, 55, 41, 67, 22, 43, 21, 70],
  },
]);
<\/script>
`,-1)])),_:1,__:[26]})):b("",!0)]),t("div",ge,[t("div",xe,[e[28]||(e[28]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Mixed",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[5]||(e[5]=d=>o(u)("code6"))},e[27]||(e[27]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",we,[a(n,null,{default:l(()=>[a(s,{height:"300",options:T.value,series:z.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code6")?(h(),k(g,{key:0},{default:l(()=>e[29]||(e[29]=[t("pre",null,`<!-- mixed -->
<apexchart height="300" :options="mixedChart" :series="mixedChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const mixedChart = computed(() => {
  const isDark = store.theme === 'dark' ? true : false;
  const isRtl = store.rtlClass === 'rtl' ? true : false;
  return {
    chart: {
      height: 300,
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    colors: ['#2196f3', '#00ab55', '#4361ee'],
    stroke: {
      width: [0, 2, 2],
      curve: 'smooth',
    },
    plotOptions: {
      bar: {
        columnWidth: '50%',
      },
    },
    fill: {
      opacity: [1, 0.25, 1],
    },

    labels: ['01/01/2022', '02/01/2022', '03/01/2022', '04/01/2022', '05/01/2022', '06/01/2022', '07/01/2022', '08/01/2022', '09/01/2022', '10/01/2022', '11/01/2022'],
    markers: {
      size: 0,
    },
    xaxis: {
      type: 'datetime',
      axisBorder: {
        color: isDark ? '#191e3a' : '#e0e6ed',
      },
    },
    yaxis: {
      title: {
        text: 'Points',
      },
      min: 0,
      opposite: isRtl ? true : false,
      labels: {
        offsetX: isRtl ? -10 : 0,
      },
    },
    grid: {
      borderColor: isDark ? '#191e3a' : '#e0e6ed',
    },
    tooltip: {
      shared: true,
      intersect: false,
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (y) => {
          if (typeof y !== 'undefined') {
            return y.toFixed(0) + ' points';
          }
          return y;
        },
      },
    },
    legend: {
      itemMargin: {
        horizontal: 4,
        vertical: 8,
      },
    },
  };
});

const mixedChartSeries = ref([
  {
    name: 'TEAM A',
    type: 'column',
    data: [23, 11, 22, 27, 13, 22, 37, 21, 44, 22, 30],
  },
  {
    name: 'TEAM B',
    type: 'area',
    data: [44, 55, 41, 67, 22, 43, 21, 41, 56, 27, 43],
  },
  {
    name: 'TEAM C',
    type: 'line',
    data: [30, 25, 36, 30, 45, 35, 64, 52, 59, 36, 39],
  },
]);
<\/script>
`,-1)])),_:1,__:[29]})):b("",!0)]),t("div",Ce,[t("div",ve,[e[31]||(e[31]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Basic Radar",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[6]||(e[6]=d=>o(u)("code7"))},e[30]||(e[30]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",ye,[a(n,null,{default:l(()=>[a(s,{height:"300",options:_.value,series:R.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code7")?(h(),k(g,{key:0},{default:l(()=>e[32]||(e[32]=[t("pre",null,`<!-- basic radar -->
<apexchart height="300" :options="radarChart" :series="radarChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const radarChart = computed(() => {
  const isDark = store.theme === 'dark' ? true : false;
  return {
    chart: {
      height: 300,
      type: 'radar',
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    colors: ['#4361ee'],
    xaxis: {
      categories: ['January', 'February', 'March', 'April', 'May', 'June'],
    },
    plotOptions: {
      radar: {
        polygons: {
          strokeColors: isDark ? '#191e3a' : '#e0e6ed',
          connectorColors: isDark ? '#191e3a' : '#e0e6ed',
        },
      },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
    },
  };
});

const radarChartSeries = ref([
  {
    name: 'Series 1',
    data: [80, 50, 30, 40, 100, 20],
  },
]);
<\/script>
`,-1)])),_:1,__:[32]})):b("",!0)]),t("div",Me,[t("div",Se,[e[34]||(e[34]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Basic Pie",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[7]||(e[7]=d=>o(u)("code8"))},e[33]||(e[33]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",Le,[a(n,null,{default:l(()=>[a(s,{height:"300",options:j.value,series:O.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code8")?(h(),k(g,{key:0},{default:l(()=>e[35]||(e[35]=[t("pre",null,`<!-- basic pie -->
<apexchart height="300" :options="pieChart" :series="pieChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const pieChart = computed(() => {
  return {
    chart: {
      height: 300,
      type: 'pie',
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    labels: ['Team A', 'Team B', 'Team C', 'Team D', 'Team E'],
    colors: ['#4361ee', '#805dca', '#00ab55', '#e7515a', '#e2a03f'],
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 200,
          },
        },
      },
    ],
    stroke: {
      show: false,
    },
    legend: {
      position: 'bottom',
    },
  };
});

const pieChartSeries = ref([44, 55, 13, 43, 22]);
<\/script>
`,-1)])),_:1,__:[35]})):b("",!0)]),t("div",Ae,[t("div",De,[e[37]||(e[37]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Basic Donut",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[8]||(e[8]=d=>o(u)("code9"))},e[36]||(e[36]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",Be,[a(n,null,{default:l(()=>[a(s,{height:"300",options:J.value,series:F.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code9")?(h(),k(g,{key:0},{default:l(()=>e[38]||(e[38]=[t("pre",null,`<!-- basic donut -->
<apexchart height="300" :options="donutChart" :series="donutChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const donutChart = computed(() => {
  return {
    chart: {
      height: 300,
      type: 'donut',
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    stroke: {
      show: false,
    },
    labels: ['Team A', 'Team B', 'Team C'],
    colors: ['#4361ee', '#805dca', '#e2a03f'],
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 200,
          },
        },
      },
    ],
    legend: {
      position: 'bottom',
    },
  };
});

const donutChartSeries = ref([44, 55, 13]);
<\/script>
`,-1)])),_:1,__:[38]})):b("",!0)]),t("div",Te,[t("div",ze,[e[40]||(e[40]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Basic Polar Area",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[9]||(e[9]=d=>o(u)("code10"))},e[39]||(e[39]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",_e,[a(n,null,{default:l(()=>[a(s,{height:"300",options:G.value,series:X.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code10")?(h(),k(g,{key:0},{default:l(()=>e[41]||(e[41]=[t("pre",null,`<!-- basic polar area -->
<apexchart height="300" :options="polarAreaChart" :series="polarAreaChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const polarAreaChart = computed(() => {
  const isDark = store.theme === 'dark' ? true : false;
  return {
    chart: {
      height: 300,
      type: 'polarArea',
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    colors: ['#4361ee', '#805dca', '#00ab55', '#e7515a', '#e2a03f', '#2196f3', '#3b3f5c'],
    stroke: {
      show: false,
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 200,
          },
        },
      },
    ],
    plotOptions: {
      polarArea: {
        rings: {
          strokeColor: isDark ? '#191e3a' : '#e0e6ed',
        },
        spokes: {
          connectorColors: isDark ? '#191e3a' : '#e0e6ed',
        },
      },
    },
    legend: {
      position: 'bottom',
    },
    fill: {
      opacity: 0.85,
    },
  };
});

const polarAreaChartSeries = ref([14, 23, 21, 17, 15, 10, 12, 17, 21]);
<\/script>
`,-1)])),_:1,__:[41]})):b("",!0)]),t("div",Re,[t("div",je,[e[43]||(e[43]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Radial Bar",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[10]||(e[10]=d=>o(u)("code11"))},e[42]||(e[42]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",Oe,[a(n,null,{default:l(()=>[a(s,{height:"300",options:$.value,series:E.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code11")?(h(),k(g,{key:0},{default:l(()=>e[44]||(e[44]=[t("pre",null,`<!-- radial bar -->
<apexchart height="300" :options="radialBarChart" :series="radialBarChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const radialBarChart = computed(() => {
  const isDark = store.theme === 'dark' ? true : false;
  return {
    chart: {
      height: 300,
      type: 'radialBar',
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    colors: ['#4361ee', '#805dca', '#e2a03f'],
    grid: {
      borderColor: isDark ? '#191e3a' : '#e0e6ed',
    },
    plotOptions: {
      radialBar: {
        dataLabels: {
          name: {
            fontSize: '22px',
          },
          value: {
            fontSize: '16px',
          },
          total: {
            show: true,
            label: 'Total',
            formatter: function (w) {
             return 249;
            },
          },
        },
      },
    },
    labels: ['Apples', 'Oranges', 'Bananas'],
    fill: {
      opacity: 0.85,
    },
  };
});

const radialBarChartSeries = ref([44, 55, 41]);
<\/script>
`,-1)])),_:1,__:[44]})):b("",!0)]),t("div",Je,[t("div",Fe,[e[46]||(e[46]=t("h5",{class:"text-lg font-semibold dark:text-white"},"Bubble Chart",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[11]||(e[11]=d=>o(u)("code12"))},e[45]||(e[45]=[p('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",Ge,[a(n,null,{default:l(()=>[a(s,{height:"300",options:P.value,series:N.value,class:"rounded-lg bg-white dark:bg-black"},null,8,["options","series"])]),_:1})]),o(c).includes("code12")?(h(),k(g,{key:0},{default:l(()=>e[47]||(e[47]=[t("pre",null,`<!-- bubble chart -->
<apexchart height="300" :options="bubbleChart" :series="bubbleChartSeries" class="bg-white dark:bg-black rounded-lg"></apexchart>

<!-- script -->
<script lang="ts" setup>
import { ref, computed } from 'vue';
import apexchart from 'vue3-apexcharts';
import { useAppStore } from '@/stores/index';
const store = useAppStore();

const generateData = (baseval, count, yrange) => {
  var i = 0;
  var series: any = [];
  while (i < count) {
    var x = Math.floor(Math.random() * (750 - 1 + 1)) + 1;
    var y = Math.floor(Math.random() * (yrange.max - yrange.min + 1)) + yrange.min;
    var z = Math.floor(Math.random() * (75 - 15 + 1)) + 15;

    series.push([x, y, z]);
    baseval += 86400000;
    i++;
  }
  return series;
};

const bubbleChart = computed(() => {
  const isDark = store.theme === 'dark' ? true : false;
  const isRtl = store.rtlClass === 'rtl' ? true : false;
  return {
    chart: {
      height: 300,
      type: 'bubble',
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    colors: ['#4361ee', '#00ab55'],
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      tickAmount: 12,
      type: 'category',
      axisBorder: {
        color: isDark ? '#191e3a' : '#e0e6ed',
      },
    },
    yaxis: {
      max: 70,
      opposite: isRtl ? true : false,
      labels: {
        offsetX: isRtl ? -10 : 0,
      },
    },
    grid: {
      borderColor: isDark ? '#191e3a' : '#e0e6ed',
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
    },
    stroke: {
      colors: isDark ? ['#191e3a'] : ['#e0e6ed'],
    },
    fill: {
      opacity: 0.85,
    },
  };
});

const bubbleChartSeries = ref([
  {
    name: 'Bubble1',
    data: generateData(new Date('11 Feb 2017 GMT').getTime(), 20, {
      min: 10,
      max: 60,
    }),
  },
  {
    name: 'Bubble2',
    data: generateData(new Date('11 Feb 2017 GMT').getTime(), 20, {
      min: 10,
      max: 60,
    }),
  },
]);
<\/script>
`,-1)])),_:1,__:[47]})):b("",!0)])])])}}});export{Ve as default};
