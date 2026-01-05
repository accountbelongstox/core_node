import{ae as Ce,r as P,aR as Ee,w as te,aS as ie,ai as me,a as Le,p as C,v as r,Q as ue,P as de,aT as Ve,aU as Pe,m as ce,d as Re,u as ze,h,k as t,q as I,c as _,s as $,G as Y,z as O,B as S,J as z,b as H,N as Te,R as ae,g as f}from"./Cs8kveBG.js";import{c as je,h as W}from"./Bykx_eDL.js";import{S as Oe}from"./BQIkj5Wb.js";import"./92s3wAHG.js";function pe(s,l){var a=Object.keys(s);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(s);l&&(o=o.filter(function(m){return Object.getOwnPropertyDescriptor(s,m).enumerable})),a.push.apply(a,o)}return a}function Z(s){for(var l=1;l<arguments.length;l++){var a=arguments[l]!=null?arguments[l]:{};l%2?pe(Object(a),!0).forEach(function(o){qe(s,o,a[o])}):Object.getOwnPropertyDescriptors?Object.defineProperties(s,Object.getOwnPropertyDescriptors(a)):pe(Object(a)).forEach(function(o){Object.defineProperty(s,o,Object.getOwnPropertyDescriptor(a,o))})}return s}function qe(s,l,a){return l in s?Object.defineProperty(s,l,{value:a,enumerable:!0,configurable:!0,writable:!0}):s[l]=a,s}function fe(s){let l=arguments.length>1&&arguments[1]!==void 0?arguments[1]:[];return Object.keys(s).reduce((a,o)=>(l.includes(o)||(a[o]=r(s[o])),a),{})}function se(s){return typeof s=="function"}function Ae(s){return Ve(s)||Pe(s)}function he(s,l,a){let o=s;const m=l.split(".");for(let c=0;c<m.length;c++){if(!o[m[c]])return a;o=o[m[c]]}return o}function le(s,l,a){return C(()=>s.some(o=>he(l,o,{[a]:!1})[a]))}function ve(s,l,a){return C(()=>s.reduce((o,m)=>{const c=he(l,m,{[a]:!1})[a]||[];return o.concat(c)},[]))}function xe(s,l,a,o){return s.call(o,r(l),r(a),o)}function we(s){return s.$valid!==void 0?!s.$valid:!s}function Ue(s,l,a,o,m,c,k){let{$lazy:p,$rewardEarly:g}=m,u=arguments.length>7&&arguments[7]!==void 0?arguments[7]:[],N=arguments.length>8?arguments[8]:void 0,v=arguments.length>9?arguments[9]:void 0,E=arguments.length>10?arguments[10]:void 0;const x=P(!!o.value),i=P(0);a.value=!1;const b=te([l,o].concat(u,E),()=>{if(p&&!o.value||g&&!v.value&&!a.value)return;let d;try{d=xe(s,l,N,k)}catch(L){d=Promise.reject(L)}i.value++,a.value=!!i.value,x.value=!1,Promise.resolve(d).then(L=>{i.value--,a.value=!!i.value,c.value=L,x.value=we(L)}).catch(L=>{i.value--,a.value=!!i.value,c.value=L,x.value=!0})},{immediate:!0,deep:typeof l=="object"});return{$invalid:x,$unwatch:b}}function Ge(s,l,a,o,m,c,k,p){let{$lazy:g,$rewardEarly:u}=o;const N=()=>({}),v=C(()=>{if(g&&!a.value||u&&!p.value)return!1;let E=!0;try{const x=xe(s,l,k,c);m.value=x,E=we(x)}catch(x){m.value=x}return E});return{$unwatch:N,$invalid:v}}function Me(s,l,a,o,m,c,k,p,g,u,N){const v=P(!1),E=s.$params||{},x=P(null);let i,b;s.$async?{$invalid:i,$unwatch:b}=Ue(s.$validator,l,v,a,o,x,m,s.$watchTargets,g,u,N):{$invalid:i,$unwatch:b}=Ge(s.$validator,l,a,o,x,m,g,u);const d=s.$message;return{$message:se(d)?C(()=>d(fe({$pending:v,$invalid:i,$params:fe(E),$model:l,$response:x,$validator:c,$propertyPath:p,$property:k}))):d||"",$params:E,$pending:v,$invalid:i,$response:x,$unwatch:b}}function Ze(){let s=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};const l=r(s),a=Object.keys(l),o={},m={},c={};let k=null;return a.forEach(p=>{const g=l[p];switch(!0){case se(g.$validator):o[p]=g;break;case se(g):o[p]={$validator:g};break;case p==="$validationGroups":k=g;break;case p.startsWith("$"):c[p]=g;break;default:m[p]=g}}),{rules:o,nestedValidators:m,config:c,validationGroups:k}}const Be="__root";function Ie(s,l,a,o,m,c,k,p,g){const u=Object.keys(s),N=o.get(m,s),v=P(!1),E=P(!1),x=P(0);if(N){if(!N.$partial)return N;N.$unwatch(),v.value=N.$dirty.value}const i={$dirty:v,$path:m,$touch:()=>{v.value||(v.value=!0)},$reset:()=>{v.value&&(v.value=!1)},$commit:()=>{}};return u.length?(u.forEach(b=>{i[b]=Me(s[b],l,i.$dirty,c,k,b,a,m,g,E,x)}),i.$externalResults=C(()=>p.value?[].concat(p.value).map((b,d)=>({$propertyPath:m,$property:a,$validator:"$externalResults",$uid:`${m}-externalResult-${d}`,$message:b,$params:{},$response:null,$pending:!1})):[]),i.$invalid=C(()=>{const b=u.some(d=>r(i[d].$invalid));return E.value=b,!!i.$externalResults.value.length||b}),i.$pending=C(()=>u.some(b=>r(i[b].$pending))),i.$error=C(()=>i.$dirty.value?i.$pending.value||i.$invalid.value:!1),i.$silentErrors=C(()=>u.filter(b=>r(i[b].$invalid)).map(b=>{const d=i[b];return me({$propertyPath:m,$property:a,$validator:b,$uid:`${m}-${b}`,$message:d.$message,$params:d.$params,$response:d.$response,$pending:d.$pending})}).concat(i.$externalResults.value)),i.$errors=C(()=>i.$dirty.value?i.$silentErrors.value:[]),i.$unwatch=()=>u.forEach(b=>{i[b].$unwatch()}),i.$commit=()=>{E.value=!0,x.value=Date.now()},o.set(m,s,i),i):(N&&o.set(m,s,i),i)}function De(s,l,a,o,m,c,k){const p=Object.keys(s);return p.length?p.reduce((g,u)=>(g[u]=ne({validations:s[u],state:l,key:u,parentKey:a,resultsCache:o,globalConfig:m,instance:c,externalResults:k}),g),{}):{}}function _e(s,l,a){const o=C(()=>[l,a].filter(i=>i).reduce((i,b)=>i.concat(Object.values(r(b))),[])),m=C({get(){return s.$dirty.value||(o.value.length?o.value.every(i=>i.$dirty):!1)},set(i){s.$dirty.value=i}}),c=C(()=>{const i=r(s.$silentErrors)||[],b=o.value.filter(d=>(r(d).$silentErrors||[]).length).reduce((d,L)=>d.concat(...L.$silentErrors),[]);return i.concat(b)}),k=C(()=>{const i=r(s.$errors)||[],b=o.value.filter(d=>(r(d).$errors||[]).length).reduce((d,L)=>d.concat(...L.$errors),[]);return i.concat(b)}),p=C(()=>o.value.some(i=>i.$invalid)||r(s.$invalid)||!1),g=C(()=>o.value.some(i=>r(i.$pending))||r(s.$pending)||!1),u=C(()=>o.value.some(i=>i.$dirty)||o.value.some(i=>i.$anyDirty)||m.value),N=C(()=>m.value?g.value||p.value:!1),v=()=>{s.$touch(),o.value.forEach(i=>{i.$touch()})},E=()=>{s.$commit(),o.value.forEach(i=>{i.$commit()})},x=()=>{s.$reset(),o.value.forEach(i=>{i.$reset()})};return o.value.length&&o.value.every(i=>i.$dirty)&&v(),{$dirty:m,$errors:k,$invalid:p,$anyDirty:u,$error:N,$pending:g,$touch:v,$reset:x,$silentErrors:c,$commit:E}}function ne(s){let{validations:l,state:a,key:o,parentKey:m,childResults:c,resultsCache:k,globalConfig:p={},instance:g,externalResults:u}=s;const N=m?`${m}.${o}`:o,{rules:v,nestedValidators:E,config:x,validationGroups:i}=Ze(l),b=Z(Z({},p),x),d=o?C(()=>{const R=r(a);return R?r(R[o]):void 0}):a,L=Z({},r(u)||{}),T=C(()=>{const R=r(u);return o?R?r(R[o]):void 0:R}),F=Ie(v,d,o,k,N,b,g,T,a),U=De(E,d,N,k,b,g,T),w={};i&&Object.entries(i).forEach(R=>{let[B,M]=R;w[B]={$invalid:le(M,U,"$invalid"),$error:le(M,U,"$error"),$pending:le(M,U,"$pending"),$errors:ve(M,U,"$errors"),$silentErrors:ve(M,U,"$silentErrors")}});const{$dirty:J,$errors:q,$invalid:Q,$anyDirty:j,$error:V,$pending:K,$touch:y,$reset:oe,$silentErrors:G,$commit:X}=_e(F,U,c),e=o?C({get:()=>r(d),set:R=>{J.value=!0;const B=r(a),M=r(u);M&&(M[o]=L[o]),ie(B[o])?B[o].value=R:B[o]=R}}):null;o&&b.$autoDirty&&te(d,()=>{J.value||y();const R=r(u);R&&(R[o]=L[o])},{flush:"sync"});async function n(){return y(),b.$rewardEarly&&(X(),await ce()),await ce(),new Promise(R=>{if(!K.value)return R(!Q.value);const B=te(K,()=>{R(!Q.value),B()})})}function Fe(R){return(c.value||{})[R]}function Se(){ie(u)?u.value=L:Object.keys(L).length===0?Object.keys(u).forEach(R=>{delete u[R]}):Object.assign(u,L)}return me(Z(Z(Z({},F),{},{$model:e,$dirty:J,$error:V,$errors:q,$invalid:Q,$anyDirty:j,$pending:K,$touch:y,$reset:oe,$path:N||Be,$silentErrors:G,$validate:n,$commit:X},c&&{$getResultsForChild:Fe,$clearExternalResults:Se,$validationGroups:w}),U))}class Ye{constructor(){this.storage=new Map}set(l,a,o){this.storage.set(l,{rules:a,result:o})}checkRulesValidity(l,a,o){const m=Object.keys(o),c=Object.keys(a);return c.length!==m.length||!c.every(p=>m.includes(p))?!1:c.every(p=>a[p].$params?Object.keys(a[p].$params).every(g=>r(o[p].$params[g])===r(a[p].$params[g])):!0)}get(l,a){const o=this.storage.get(l);if(!o)return;const{rules:m,result:c}=o,k=this.checkRulesValidity(l,a,m),p=c.$unwatch?c.$unwatch:()=>({});return k?c:{$dirty:c.$dirty,$partial:!0,$unwatch:p}}}const re={COLLECT_ALL:!0,COLLECT_NONE:!1},be=Symbol("vuelidate#injectChildResults"),$e=Symbol("vuelidate#removeChildResults");function He(s){let{$scope:l,instance:a}=s;const o={},m=P([]),c=C(()=>m.value.reduce((N,v)=>(N[v]=r(o[v]),N),{}));function k(N,v){let{$registerAs:E,$scope:x,$stopPropagation:i}=v;i||l===re.COLLECT_NONE||x===re.COLLECT_NONE||l!==re.COLLECT_ALL&&l!==x||(o[E]=N,m.value.push(E))}a.__vuelidateInjectInstances=[].concat(a.__vuelidateInjectInstances||[],k);function p(N){m.value=m.value.filter(v=>v!==N),delete o[N]}a.__vuelidateRemoveInstances=[].concat(a.__vuelidateRemoveInstances||[],p);const g=ue(be,[]);de(be,a.__vuelidateInjectInstances);const u=ue($e,[]);return de($e,a.__vuelidateRemoveInstances),{childResults:c,sendValidationResultsToParent:g,removeValidationResultsFromParent:u}}function ke(s){return new Proxy(s,{get(l,a){return typeof l[a]=="object"?ke(l[a]):C(()=>l[a])}})}let ge=0;function ee(s,l){var a;let o=arguments.length>2&&arguments[2]!==void 0?arguments[2]:{};arguments.length===1&&(o=s,s=void 0,l=void 0);let{$registerAs:m,$scope:c=re.COLLECT_ALL,$stopPropagation:k,$externalResults:p,currentVueInstance:g}=o;const u=g||((a=Ce())===null||a===void 0?void 0:a.proxy),N=u?u.$options:{};m||(ge+=1,m=`_vuelidate_${ge}`);const v=P({}),E=new Ye,{childResults:x,sendValidationResultsToParent:i,removeValidationResultsFromParent:b}=u?He({$scope:c,instance:u}):{childResults:P({})};if(!s&&N.validations){const d=N.validations;l=P({}),Ee(()=>{l.value=u,te(()=>se(d)?d.call(l.value,new ke(l.value)):d,L=>{v.value=ne({validations:L,state:l,childResults:x,resultsCache:E,globalConfig:o,instance:u,externalResults:p||u.vuelidateExternalResults})},{immediate:!0})}),o=N.validationsConfig||o}else{const d=ie(s)||Ae(s)?s:me(s||{});te(d,L=>{v.value=ne({validations:L,state:l,childResults:x,resultsCache:E,globalConfig:o,instance:u??{},externalResults:p})},{immediate:!0})}return u&&(i.forEach(d=>d(v,{$registerAs:m,$scope:c,$stopPropagation:k})),Le(()=>b.forEach(d=>d(m)))),C(()=>Z(Z({},r(v.value)),x.value))}const Ne=s=>{if(s=r(s),Array.isArray(s))return!!s.length;if(s==null)return!1;if(s===!1)return!0;if(s instanceof Date)return!isNaN(s.getTime());if(typeof s=="object"){for(let l in s)return!0;return!1}return!!String(s).length};function D(){for(var s=arguments.length,l=new Array(s),a=0;a<s;a++)l[a]=arguments[a];return o=>(o=r(o),!Ne(o)||l.every(m=>(m.lastIndex=0,m.test(o))))}D(/^[a-zA-Z]*$/);D(/^[a-zA-Z0-9]*$/);D(/^\d*(\.\d+)?$/);const We=/^(?:[A-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]{2,}(?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;var Je=D(We),Qe={$validator:Je,$message:"Value is not a valid email address",$params:{type:"email"}};function Ke(s){return typeof s=="string"&&(s=s.trim()),Ne(s)}var A={$validator:Ke,$message:"Value is required",$params:{type:"required"}};function Xe(s){return l=>r(l)===r(s)}function ye(s){let l=arguments.length>1&&arguments[1]!==void 0?arguments[1]:"other";return{$validator:Xe(s),$message:a=>`The value must be equal to the ${l} value`,$params:{equalTo:s,otherName:l,type:"sameAs"}}}const et=/^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?$/i;D(et);D(/(^[0-9]*$)|(^-[0-9]+$)/);D(/^[-]?\d*(\.\d+)?$/);const tt={class:"space-y-8 pt-5"},rt={class:"grid grid-cols-1 gap-6 xl:grid-cols-2"},st={class:"panel"},ot={class:"mb-5 flex items-center justify-between"},at={class:"mb-5"},lt={key:0,class:"mt-1 text-[#1abc9c]"},it={key:1,class:"mt-1 text-danger"},nt={class:"panel"},mt={class:"mb-5 flex items-center justify-between"},ut={class:"mb-5"},dt={key:0,class:"mt-1 text-[#1abc9c]"},ct={key:1,class:"mt-1 text-danger"},pt={class:"panel"},ft={class:"mb-5 flex items-center justify-between"},vt={class:"mb-5"},bt={key:0,class:"mt-1 text-[#1abc9c]"},$t={key:1,class:"mt-1 text-danger"},gt={class:"panel"},yt={class:"mb-5 flex items-center justify-between"},ht={class:"mb-5"},xt={class:"grid grid-cols-1 gap-5 md:grid-cols-3"},wt={key:0,class:"mt-1 text-[#1abc9c]"},kt={key:1,class:"mt-1 text-danger"},Nt={key:0,class:"mt-1 text-[#1abc9c]"},Ft={key:1,class:"mt-1 text-danger"},St={class:"flex"},Ct={key:0,class:"mt-1 text-[#1abc9c]"},Et={key:1,class:"mt-1 text-danger"},Lt={class:"grid grid-cols-1 gap-5 md:grid-cols-4"},Vt={key:0,class:"mt-1 text-[#1abc9c]"},Pt={key:1,class:"mt-1 text-danger"},Rt={key:0,class:"mt-1 text-[#1abc9c]"},zt={key:1,class:"mt-1 text-danger"},Tt={key:0,class:"mt-1 text-[#1abc9c]"},jt={key:1,class:"mt-1 text-danger"},Ot={class:"mt-1 inline-flex cursor-pointer"},qt={key:0,class:"mt-1 text-danger"},At={class:"panel"},Ut={class:"mb-5 flex items-center justify-between"},Gt={class:"mb-5"},Mt={class:"grid grid-cols-1 gap-5 md:grid-cols-3"},Zt={class:"flex"},Bt={class:"grid grid-cols-1 gap-5 md:grid-cols-4"},It={class:"md:col-span-2"},Dt={class:"mt-1 flex cursor-pointer items-center"},_t={class:"panel"},Yt={class:"mb-5 flex items-center justify-between"},Ht={class:"mb-5"},Wt={class:"grid grid-cols-1 gap-5 md:grid-cols-3"},Jt={key:0,class:"rounded bg-[#1abc9c] py-1 px-2 text-white"},Qt={key:1,class:"rounded bg-danger py-1 px-2 text-white"},Kt={key:0,class:"rounded bg-[#1abc9c] py-1 px-2 text-white"},Xt={key:1,class:"rounded bg-danger py-1 px-2 text-white"},er={class:"flex"},tr={class:"mt-2"},rr={key:0,class:"rounded bg-[#1abc9c] py-1 px-2 text-white"},sr={key:1,class:"rounded bg-danger py-1 px-2 text-white"},or={class:"grid grid-cols-1 gap-5 md:grid-cols-4"},ar={key:0,class:"rounded bg-[#1abc9c] py-1 px-2 text-white"},lr={key:1,class:"rounded bg-danger py-1 px-2 text-white"},ir={key:0,class:"rounded bg-[#1abc9c] py-1 px-2 text-white"},nr={key:1,class:"rounded bg-danger py-1 px-2 text-white"},mr={key:0,class:"rounded bg-[#1abc9c] py-1 px-2 text-white"},ur={key:1,class:"rounded bg-danger py-1 px-2 text-white"},dr={class:"flex cursor-pointer items-center"},cr={key:0,class:"mt-2"},$r=Re({__name:"validation",setup(s){ze({title:"Form Validation"});const{codeArr:l,toggleCode:a}=je(),o=P({name:""}),m=P(!1),k=ee({form1:{name:{required:A}}},{form1:o}),p=()=>{if(m.value=!0,k.value.form1.$touch(),k.value.form1.$invalid)return!1;G("Form submitted successfully.")},g=P({email:""}),u=P(!1),v=ee({form2:{email:{required:A,email:Qe}}},{form2:g}),E=()=>{if(u.value=!0,v.value.form2.$touch(),v.value.form2.$invalid)return!1;G("Form submitted successfully.")},x=P({select:""}),i=P(!1),d=ee({form3:{select:{required:A}}},{form3:x}),L=()=>{if(i.value=!0,d.value.form3.$touch(),d.value.form3.$invalid)return!1;G("Form submitted successfully.")},T=P({firstName:"Shaun",lastName:"Park",userName:"",city:"",state:"",zip:"",isTerms:!1}),F=P(!1),U={form4:{firstName:{required:A},lastName:{required:A},userName:{required:A},city:{required:A},state:{required:A},zip:{required:A},isTerms:{sameAsRawValue:ye(!0)}}},w=ee(U,{form4:T}),J=()=>{if(F.value=!0,w.value.form4.$touch(),w.value.form4.$invalid)return!1;G("Form submitted successfully.")},q=P({firstName:"Shaun",lastName:"Park",userName:"",city:"",state:"",zip:"",isTerms:!1}),Q=()=>{G("Form submitted successfully.")},j=P({firstName:"Shaun",lastName:"Park",userName:"",city:"",state:"",zip:"",isTerms:!1}),V=P(!1),K={form6:{firstName:{required:A},lastName:{required:A},userName:{required:A},city:{required:A},state:{required:A},zip:{required:A},isTerms:{sameAsRawValue:ye(!0)}}},y=ee(K,{form6:j}),oe=()=>{if(V.value=!0,y.value.form6.$touch(),y.value.form6.$invalid)return!1;G("Form submitted successfully.")},G=(X="",e="success")=>{Oe.mixin({toast:!0,position:"top",showConfirmButton:!1,timer:3e3,customClass:{container:"toast"}}).fire({icon:e,title:X,padding:"10px 20px"})};return(X,e)=>(f(),h("div",null,[e[89]||(e[89]=t("ul",{class:"flex space-x-2 rtl:space-x-reverse"},[t("li",null,[t("a",{href:"javascript:;",class:"text-primary hover:underline"},"Forms")]),t("li",{class:"before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"},[t("span",null,"Validation")])],-1)),t("div",tt,[e[88]||(e[88]=I('<div class="panel flex items-center overflow-x-auto whitespace-nowrap p-3 text-primary"><div class="rounded-full bg-primary p-1.5 text-white ring-2 ring-primary/30 ltr:mr-3 rtl:ml-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5"><path d="M19.0001 9.7041V9C19.0001 5.13401 15.8661 2 12.0001 2C8.13407 2 5.00006 5.13401 5.00006 9V9.7041C5.00006 10.5491 4.74995 11.3752 4.28123 12.0783L3.13263 13.8012C2.08349 15.3749 2.88442 17.5139 4.70913 18.0116C9.48258 19.3134 14.5175 19.3134 19.291 18.0116C21.1157 17.5139 21.9166 15.3749 20.8675 13.8012L19.7189 12.0783C19.2502 11.3752 19.0001 10.5491 19.0001 9.7041Z" stroke="currentColor" stroke-width="1.5"></path><path opacity="0.5" d="M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></div><span class="ltr:mr-3 rtl:ml-3">Documentation: </span><a href="https://www.npmjs.com/package/vuelidate" target="_blank" class="block hover:underline">https://www.npmjs.com/package/vuelidate</a></div>',1)),t("div",rt,[t("div",st,[t("div",ot,[e[37]||(e[37]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Basic",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[0]||(e[0]=n=>r(a)("code1"))},e[36]||(e[36]=[I('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",at,[t("form",{class:"space-y-5",onSubmit:e[2]||(e[2]=Y(n=>p(),["prevent"]))},[t("div",{class:O({"has-error":r(k).form1.name.$error,"has-success":m.value&&!r(k).form1.name.$error})},[e[38]||(e[38]=t("label",{for:"fullName"},"Full Name",-1)),S(t("input",{id:"fullName",type:"text",placeholder:"Enter Full Name",class:"form-input","onUpdate:modelValue":e[1]||(e[1]=n=>o.value.name=n)},null,512),[[z,o.value.name]]),m.value&&!r(k).form1.name.$error?(f(),h("p",lt,"Looks Good!")):$("",!0),m.value&&r(k).form1.name.$error?(f(),h("p",it,"Please fill the Name")):$("",!0)],2),e[39]||(e[39]=t("button",{type:"submit",class:"btn btn-primary !mt-6"},"Submit Form",-1))],32)]),r(l).includes("code1")?(f(),_(W,{key:0},{default:H(()=>e[40]||(e[40]=[t("pre",null,`  <!-- basic -->
  <form class="space-y-5" @submit.prevent="submitForm1()">
    <div :class="{ 'has-error': $v1.form1.name.$error, 'has-success': isSubmitForm1 && !$v1.form1.name.$error }">
      <label for="fullName">Full Name</label>
      <input id="fullName" type="text" placeholder="Enter Full Name" class="form-input" v-model="form1.name" />
      <template v-if="isSubmitForm1 && !$v1.form1.name.$error">
        <p class="text-[#1abc9c] mt-1">Looks Good!</p>
      </template>
      <template v-if="isSubmitForm1 && $v1.form1.name.$error">
        <p class="text-danger mt-1">Please fill the Name</p>
      </template>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit Form</button>
  </form>

  <!-- script -->
  <script lang="ts" setup>
    import { ref } from 'vue';
    import { useVuelidate } from '@vuelidate/core';
    import { required, email, sameAs } from '@vuelidate/validators';
    const form1 = ref({
      name: '',
    });
    const isSubmitForm1 = ref(false);
    const rules1 = {
      form1: {
        name: { required },
      },
    };
    const $v1 = useVuelidate(rules1, { form1 });
    const submitForm1 = () => {
      isSubmitForm1.value = true;
      $v1.value.form1.$touch();
      if ($v1.value.form1.$invalid) {
        return false;
      }
      //form validated success
      showMessage('Form submitted successfully.');
    };
  <\/script>
  `,-1)])),_:1,__:[40]})):$("",!0)]),t("div",nt,[t("div",mt,[e[42]||(e[42]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Email",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[3]||(e[3]=n=>r(a)("code2"))},e[41]||(e[41]=[I('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",ut,[t("form",{class:"space-y-5",onSubmit:e[5]||(e[5]=Y(n=>E(),["prevent"]))},[t("div",{class:O({"has-error":r(v).form2.email.$error,"has-success":u.value&&!r(v).form2.email.$error})},[e[43]||(e[43]=t("label",{for:"Email"},"Email",-1)),S(t("input",{id:"Email",type:"text",placeholder:"Enter Email",class:"form-input","onUpdate:modelValue":e[4]||(e[4]=n=>g.value.email=n)},null,512),[[z,g.value.email]]),u.value&&!r(v).form2.email.$error?(f(),h("p",dt,"Looks Good!")):$("",!0),u.value&&r(v).form2.email.$error?(f(),h("p",ct,"Please fill the Email")):$("",!0)],2),e[44]||(e[44]=t("button",{type:"submit",class:"btn btn-primary !mt-6"},"Submit Form",-1))],32)]),r(l).includes("code2")?(f(),_(W,{key:0},{default:H(()=>e[45]||(e[45]=[t("pre",null,`  <!-- email -->
  <form class="space-y-5" @submit.prevent="submitForm2()">
    <div :class="{ 'has-error': $v2.form2.email.$error, 'has-success': isSubmitForm2 && !$v2.form2.email.$error }">
      <label for="Email">Email</label>
      <input id="Email" type="text" placeholder="Enter Email" class="form-input" v-model="form2.email" />
      <template v-if="isSubmitForm2 && !$v2.form2.email.$error">
        <p class="text-[#1abc9c] mt-1">Looks Good!</p>
      </template>
      <template v-if="isSubmitForm2 && $v2.form2.email.$error">
        <p class="text-danger mt-1">Please fill the Email</p>
      </template>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit Form</button>
  </form>

  <!-- script -->
  <script lang="ts" setup>
    import { ref } from 'vue';
    import { useVuelidate } from '@vuelidate/core';
    import { required, email, sameAs } from '@vuelidate/validators';


    const form2 = ref({
      email: '',
    });
    const isSubmitForm2 = ref(false);
    const rules2 = {
      form2: {
        email: { required, email },
      },
    };
    const $v2 = useVuelidate(rules2, { form2 });
    const submitForm2 = () => {
      isSubmitForm2.value = true;
      $v2.value.form2.$touch();
      if ($v2.value.form2.$invalid) {
        return false;
      }
      //form validated success
      showMessage('Form submitted successfully.');
    };
  <\/script>
  `,-1)])),_:1,__:[45]})):$("",!0)]),t("div",pt,[t("div",ft,[e[47]||(e[47]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Select",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[6]||(e[6]=n=>r(a)("code3"))},e[46]||(e[46]=[I('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",vt,[t("form",{class:"space-y-5",onSubmit:e[8]||(e[8]=Y(n=>L(),["prevent"]))},[t("div",{class:O({"has-error":r(d).form3.select.$error,"has-success":i.value&&!r(d).form3.select.$error})},[S(t("select",{class:"form-select text-white-dark","onUpdate:modelValue":e[7]||(e[7]=n=>x.value.select=n)},e[48]||(e[48]=[t("option",{value:""},"Open this select menu",-1),t("option",{value:"1"},"One",-1),t("option",{value:"2"},"Two",-1),t("option",{value:"3"},"Three",-1)]),512),[[Te,x.value.select]]),i.value&&!r(d).form3.select.$error?(f(),h("p",bt,"Example valid custom select feedback")):$("",!0),i.value&&r(d).form3.select.$error?(f(),h("p",$t,"Please Select the field")):$("",!0)],2),e[49]||(e[49]=t("button",{type:"submit",class:"btn btn-primary !mt-6"},"Submit Form",-1))],32)]),r(l).includes("code3")?(f(),_(W,{key:0},{default:H(()=>e[50]||(e[50]=[t("pre",null,`  <!-- select -->
  <form class="space-y-5" @submit.prevent="submitForm3()">
    <div :class="{ 'has-error': $v3.form3.select.$error, 'has-success': isSubmitForm3 && !$v3.form3.select.$error }">
      <select class="form-select text-white-dark" v-model="form3.select">
        <option value="">Open this select menu</option>
        <option value="1">One</option>
        <option value="2">Two</option>
        <option value="3">Three</option>
      </select>
      <template v-if="isSubmitForm3 && !$v3.form3.select.$error">
        <p class="text-[#1abc9c] mt-1">Example valid custom select feedback</p>
      </template>
      <template v-if="isSubmitForm3 && $v3.form3.select.$error">
        <p class="text-danger mt-1">Please Select the field</p>
      </template>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit Form</button>
  </form>

  <!-- script -->
  <script lang="ts" setup>
    import { ref } from 'vue';
    import { useVuelidate } from '@vuelidate/core';
    import { required, email, sameAs } from '@vuelidate/validators';

    const form3 = ref({
      select: '',
    });
    const isSubmitForm3 = ref(false);
    const rules3 = {
      form3: {
        select: { required },
      },
    };
    const $v3 = useVuelidate(rules3, { form3 });
    const submitForm3 = () => {
      isSubmitForm3.value = true;
      $v3.value.form3.$touch();
      if ($v3.value.form3.$invalid) {
        return false;
      }
      //form validated success
      showMessage('Form submitted successfully.');
    };
  <\/script>
  `,-1)])),_:1,__:[50]})):$("",!0)]),t("div",gt,[t("div",yt,[e[52]||(e[52]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Custom Styles",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[9]||(e[9]=n=>r(a)("code4"))},e[51]||(e[51]=[I('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",ht,[t("form",{class:"space-y-5",onSubmit:e[17]||(e[17]=Y(n=>J(),["prevent"]))},[t("div",xt,[t("div",{class:O({"has-error":r(w).form4.firstName.$error,"has-success":F.value&&!r(w).form4.firstName.$error})},[e[53]||(e[53]=t("label",{for:"customFname"},"First Name",-1)),S(t("input",{id:"customFname",type:"text",placeholder:"Enter First Name",class:"form-input","onUpdate:modelValue":e[10]||(e[10]=n=>T.value.firstName=n)},null,512),[[z,T.value.firstName]]),F.value&&!r(w).form4.firstName.$error?(f(),h("p",wt,"Looks Good!")):$("",!0),F.value&&r(w).form4.firstName.$error?(f(),h("p",kt,"Please fill the first name")):$("",!0)],2),t("div",{class:O({"has-error":r(w).form4.lastName.$error,"has-success":F.value&&!r(w).form4.lastName.$error})},[e[54]||(e[54]=t("label",{for:"customLname"},"Last name",-1)),S(t("input",{id:"customLname",type:"text",placeholder:"Enter Last Name",class:"form-input","onUpdate:modelValue":e[11]||(e[11]=n=>T.value.lastName=n)},null,512),[[z,T.value.lastName]]),F.value&&!r(w).form4.lastName.$error?(f(),h("p",Nt,"Looks Good!")):$("",!0),F.value&&r(w).form4.lastName.$error?(f(),h("p",Ft,"Please fill the last name")):$("",!0)],2),t("div",{class:O({"has-error":r(w).form4.userName.$error,"has-success":F.value&&!r(w).form4.userName.$error})},[e[56]||(e[56]=t("label",{for:"customeEmail"},"Username",-1)),t("div",St,[e[55]||(e[55]=t("div",{class:"flex items-center justify-center border border-[#e0e6ed] bg-[#eee] px-3 font-semibold ltr:rounded-l-md ltr:border-r-0 rtl:rounded-r-md rtl:border-l-0 dark:border-[#17263c] dark:bg-[#1b2e4b]"}," @ ",-1)),S(t("input",{id:"customeEmail",type:"text",placeholder:"Enter Username",class:"form-input ltr:rounded-l-none rtl:rounded-r-none","onUpdate:modelValue":e[12]||(e[12]=n=>T.value.userName=n)},null,512),[[z,T.value.userName]])]),F.value&&!r(w).form4.userName.$error?(f(),h("p",Ct,"Looks Good!")):$("",!0),F.value&&r(w).form4.userName.$error?(f(),h("p",Et,"Please choose a userName")):$("",!0)],2)]),t("div",Lt,[t("div",{class:O(["md:col-span-2",{"has-error":r(w).form4.city.$error,"has-success":F.value&&!r(w).form4.city.$error}])},[e[57]||(e[57]=t("label",{for:"customeCity"},"City",-1)),S(t("input",{id:"customeCity",type:"text",placeholder:"Enter City",class:"form-input","onUpdate:modelValue":e[13]||(e[13]=n=>T.value.city=n)},null,512),[[z,T.value.city]]),F.value&&!r(w).form4.city.$error?(f(),h("p",Vt,"Looks Good!")):$("",!0),F.value&&r(w).form4.city.$error?(f(),h("p",Pt,"Please provide a valid city")):$("",!0)],2),t("div",{class:O({"has-error":r(w).form4.state.$error,"has-success":F.value&&!r(w).form4.state.$error})},[e[58]||(e[58]=t("label",{for:"customeState"},"State",-1)),S(t("input",{id:"customeState",type:"text",placeholder:"Enter State",class:"form-input","onUpdate:modelValue":e[14]||(e[14]=n=>T.value.state=n)},null,512),[[z,T.value.state]]),F.value&&!r(w).form4.state.$error?(f(),h("p",Rt,"Looks Good!")):$("",!0),F.value&&r(w).form4.state.$error?(f(),h("p",zt,"Please provide a valid state")):$("",!0)],2),t("div",{class:O({"has-error":r(w).form4.zip.$error,"has-success":F.value&&!r(w).form4.zip.$error})},[e[59]||(e[59]=t("label",{for:"customeZip"},"Zip",-1)),S(t("input",{id:"customeZip",type:"text",placeholder:"Enter Zip",class:"form-input","onUpdate:modelValue":e[15]||(e[15]=n=>T.value.zip=n)},null,512),[[z,T.value.zip]]),F.value&&!r(w).form4.zip.$error?(f(),h("p",Tt,"Looks Good!")):$("",!0),F.value&&r(w).form4.zip.$error?(f(),h("p",jt,"Please provide a valid zip")):$("",!0)],2)]),t("div",{class:O({"has-error":r(w).form4.isTerms.$error,"has-success":F.value&&!r(w).form4.isTerms.$error})},[t("label",Ot,[S(t("input",{type:"checkbox",class:"form-checkbox","onUpdate:modelValue":e[16]||(e[16]=n=>T.value.isTerms=n)},null,512),[[ae,T.value.isTerms]]),e[60]||(e[60]=t("span",{class:"text-white-dark"},"Agree to terms and conditions",-1))]),F.value&&r(w).form4.isTerms.$error?(f(),h("p",qt,"You must agree before submitting.")):$("",!0)],2),e[61]||(e[61]=t("button",{type:"submit",class:"btn btn-primary !mt-6"},"Submit Form",-1))],32)]),r(l).includes("code4")?(f(),_(W,{key:0},{default:H(()=>e[62]||(e[62]=[t("pre",null,`  <!-- custom styles -->
  <form class="space-y-5" @submit.prevent="submitForm4()">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div :class="{ 'has-error': $v4.form4.firstName.$error, 'has-success': isSubmitForm4 && !$v4.form4.firstName.$error }">
        <label for="customFname">First Name</label>
        <input id="customFname" type="text" placeholder="Enter First Name" class="form-input" v-model="form4.firstName" />
        <template v-if="isSubmitForm4 && !$v4.form4.firstName.$error">
          <p class="text-[#1abc9c] mt-1">Looks Good!</p>
        </template>
        <template v-if="isSubmitForm4 && $v4.form4.firstName.$error">
          <p class="text-danger mt-1">Please fill the first name</p>
        </template>
      </div>
      <div :class="{ 'has-error': $v4.form4.lastName.$error, 'has-success': isSubmitForm4 && !$v4.form4.lastName.$error }">
        <label for="customLname">Last name</label>
        <input id="customLname" type="text" placeholder="Enter Last Name" class="form-input" v-model="form4.lastName" />
        <template v-if="isSubmitForm4 && !$v4.form4.lastName.$error">
          <p class="text-[#1abc9c] mt-1">Looks Good!</p>
        </template>
        <template v-if="isSubmitForm4 && $v4.form4.lastName.$error">
          <p class="text-danger mt-1">Please fill the last name</p>
        </template>
      </div>
      <div :class="{ 'has-error': $v4.form4.userName.$error, 'has-success': isSubmitForm4 && !$v4.form4.userName.$error }">
        <label for="customeEmail">Username</label>
        <div class="flex">
          <div
            class="
              bg-[#eee]
              flex
              justify-center
              items-center
              ltr:rounded-l-md
              rtl:rounded-r-md
              px-3
              font-semibold
              border
              ltr:border-r-0
              rtl:border-l-0
              border-[#e0e6ed]
              dark:border-[#17263c] dark:bg-[#1b2e4b]
            "
          >
            @
          </div>
          <input id="customeEmail" type="text" placeholder="Enter Username" class="form-input ltr:rounded-l-none rtl:rounded-r-none" v-model="form4.userName" />
        </div>
        <template v-if="isSubmitForm4 && !$v4.form4.userName.$error">
          <p class="text-[#1abc9c] mt-1">Looks Good!</p>
        </template>
        <template v-if="isSubmitForm4 && $v4.form4.userName.$error">
          <p class="text-danger mt-1">Please choose a userName</p>
        </template>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-5">
      <div class="md:col-span-2" :class="{ 'has-error': $v4.form4.city.$error, 'has-success': isSubmitForm4 && !$v4.form4.city.$error }">
        <label for="customeCity">City</label>
        <input id="customeCity" type="text" placeholder="Enter City" class="form-input" v-model="form4.city" />
        <template v-if="isSubmitForm4 && !$v4.form4.city.$error">
          <p class="text-[#1abc9c] mt-1">Looks Good!</p>
        </template>
        <template v-if="isSubmitForm4 && $v4.form4.city.$error">
          <p class="text-danger mt-1">Please provide a valid city</p>
        </template>
      </div>
      <div :class="{ 'has-error': $v4.form4.state.$error, 'has-success': isSubmitForm4 && !$v4.form4.state.$error }">
        <label for="customeState">State</label>
        <input id="customeState" type="text" placeholder="Enter State" class="form-input" v-model="form4.state" />
        <template v-if="isSubmitForm4 && !$v4.form4.state.$error">
          <p class="text-[#1abc9c] mt-1">Looks Good!</p>
        </template>
        <template v-if="isSubmitForm4 && $v4.form4.state.$error">
          <p class="text-danger mt-1">Please provide a valid state</p>
        </template>
      </div>
      <div :class="{ 'has-error': $v4.form4.zip.$error, 'has-success': isSubmitForm4 && !$v4.form4.zip.$error }">
        <label for="customeZip">Zip</label>
        <input id="customeZip" type="text" placeholder="Enter Zip" class="form-input" v-model="form4.zip" />
        <template v-if="isSubmitForm4 && !$v4.form4.zip.$error">
          <p class="text-[#1abc9c] mt-1">Looks Good!</p>
        </template>
        <template v-if="isSubmitForm4 && $v4.form4.zip.$error">
          <p class="text-danger mt-1">Please provide a valid zip</p>
        </template>
      </div>
    </div>
    <div :class="{ 'has-error': $v4.form4.isTerms.$error, 'has-success': isSubmitForm4 && !$v4.form4.isTerms.$error }">
      <label class="inline-flex cursor-pointer mt-1">
        <input type="checkbox" class="form-checkbox" v-model="form4.isTerms" />
        <span class="text-white-dark">Agree to terms and conditions</span>
      </label>
      <template v-if="isSubmitForm4 && $v4.form4.isTerms.$error">
        <p class="text-danger mt-1">You must agree before submitting.</p>
      </template>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit Form</button>
  </form>

  <!-- script -->
  <script lang="ts" setup>
    import { ref } from 'vue';
    import { useVuelidate } from '@vuelidate/core';
    import { required, email, sameAs } from '@vuelidate/validators';

    const form4 = ref({
      firstName: 'Shaun',
      lastName: 'Park',
      userName: '',
      city: '',
      state: '',
      zip: '',
      isTerms: false,
    });
    const isSubmitForm4 = ref(false);
    const rules4 = {
      form4: {
        firstName: { required },
        lastName: { required },
        userName: { required },
        city: { required },
        state: { required },
        zip: { required },
        isTerms: {
          sameAsRawValue: sameAs(true),
        },
      },
    };
    const $v4 = useVuelidate(rules4, { form4 });
    const submitForm4 = () => {
      isSubmitForm4.value = true;
      $v4.value.form4.$touch();
      if ($v4.value.form4.$invalid) {
        return false;
      }
      //form validated success
      showMessage('Form submitted successfully.');
    };

  <\/script>
  `,-1)])),_:1,__:[62]})):$("",!0)]),t("div",At,[t("div",Ut,[e[64]||(e[64]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Browser Default",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[18]||(e[18]=n=>r(a)("code5"))},e[63]||(e[63]=[I('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",Gt,[t("form",{class:"space-y-5",onSubmit:e[26]||(e[26]=Y(n=>Q(),["prevent"]))},[t("div",Mt,[t("div",null,[e[65]||(e[65]=t("label",{for:"browserFname"},"First Name",-1)),S(t("input",{id:"browserFname",type:"text",placeholder:"Enter First Name","onUpdate:modelValue":e[19]||(e[19]=n=>q.value.firstName=n),class:"form-input",required:""},null,512),[[z,q.value.firstName]])]),t("div",null,[e[66]||(e[66]=t("label",{for:"browserLname"},"Last name",-1)),S(t("input",{id:"browserLname",type:"text",placeholder:"Enter Last name","onUpdate:modelValue":e[20]||(e[20]=n=>q.value.lastName=n),class:"form-input",required:""},null,512),[[z,q.value.lastName]])]),t("div",null,[e[68]||(e[68]=t("label",{for:"browserEmail"},"Username",-1)),t("div",Zt,[e[67]||(e[67]=t("div",{class:"flex items-center justify-center border border-[#e0e6ed] bg-[#eee] px-3 font-semibold ltr:rounded-l-md ltr:border-r-0 rtl:rounded-r-md rtl:border-l-0 dark:border-[#17263c] dark:bg-[#1b2e4b]"}," @ ",-1)),S(t("input",{id:"browserEmail",type:"text",placeholder:"Enter Username","onUpdate:modelValue":e[21]||(e[21]=n=>q.value.userName=n),class:"form-input ltr:rounded-l-none rtl:rounded-r-none",required:""},null,512),[[z,q.value.userName]])])])]),t("div",Bt,[t("div",It,[e[69]||(e[69]=t("label",{for:"browserCity"},"City",-1)),S(t("input",{id:"browserCity",type:"text",placeholder:"Enter City","onUpdate:modelValue":e[22]||(e[22]=n=>q.value.city=n),class:"form-input",required:""},null,512),[[z,q.value.city]])]),t("div",null,[e[70]||(e[70]=t("label",{for:"browserState"},"State",-1)),S(t("input",{id:"browserState",type:"text",placeholder:"Enter State","onUpdate:modelValue":e[23]||(e[23]=n=>q.value.state=n),class:"form-input",required:""},null,512),[[z,q.value.state]])]),t("div",null,[e[71]||(e[71]=t("label",{for:"browserZip"},"Zip",-1)),S(t("input",{id:"browserZip",type:"text",placeholder:"Enter Zip","onUpdate:modelValue":e[24]||(e[24]=n=>q.value.zip=n),class:"form-input",required:""},null,512),[[z,q.value.zip]])])]),t("div",null,[t("label",Dt,[S(t("input",{type:"checkbox",class:"form-checkbox","onUpdate:modelValue":e[25]||(e[25]=n=>q.value.isTerms=n),required:""},null,512),[[ae,q.value.isTerms]]),e[72]||(e[72]=t("span",{class:"text-white-dark"},"Agree to terms and conditions",-1))])]),e[73]||(e[73]=t("button",{type:"submit",class:"btn btn-primary !mt-6"},"Submit Form",-1))],32)]),r(l).includes("code5")?(f(),_(W,{key:0},{default:H(()=>e[74]||(e[74]=[t("pre",null,`  <!-- browser default -->
  <form class="space-y-5" @submit.prevent="submitForm5()">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div>
        <label for="browserFname">First Name</label>
        <input id="browserFname" type="text" placeholder="Enter First Name" v-model="form5.firstName" class="form-input" required />
      </div>
      <div>
        <label for="browserLname">Last name</label>
        <input id="browserLname" type="text" placeholder="Enter Last name" v-model="form5.lastName" class="form-input" required />
      </div>
      <div>
        <label for="browserEmail">Username</label>
        <div class="flex">
          <div
            class="
              bg-[#eee]
              flex
              justify-center
              items-center
              ltr:rounded-l-md
              rtl:rounded-r-md
              px-3
              font-semibold
              border
              ltr:border-r-0
              rtl:border-l-0
              border-[#e0e6ed]
              dark:border-[#17263c] dark:bg-[#1b2e4b]
            "
          >
            @
          </div>
          <input id="browserEmail" type="text" placeholder="Enter Username" v-model="form5.userName" class="form-input ltr:rounded-l-none rtl:rounded-r-none" required />
        </div>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-5">
      <div class="md:col-span-2">
        <label for="browserCity">City</label>
        <input id="browserCity" type="text" placeholder="Enter City" v-model="form5.city" class="form-input" required />
      </div>
      <div>
        <label for="browserState">State</label>
        <input id="browserState" type="text" placeholder="Enter State" v-model="form5.state" class="form-input" required />
      </div>
      <div>
        <label for="browserZip">Zip</label>
        <input id="browserZip" type="text" placeholder="Enter Zip" v-model="form5.zip" class="form-input" required />
      </div>
    </div>
    <div>
      <label class="flex items-center cursor-pointer mt-1">
        <input type="checkbox" class="form-checkbox" v-model="form5.isTerms" required />
        <span class="text-white-dark">Agree to terms and conditions</span>
      </label>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit Form</button>
  </form>

  <!-- script -->
  <script lang="ts" setup>
    import { ref } from 'vue';
    import { useVuelidate } from '@vuelidate/core';
    import { required, email, sameAs } from '@vuelidate/validators';

    const form5 = ref({
      firstName: 'Shaun',
      lastName: 'Park',
      userName: '',
      city: '',
      state: '',
      zip: '',
      isTerms: false,
    });
    const submitForm5 = () => {
      //form validated success
      showMessage('Form submitted successfully.');
    };
  <\/script>
  `,-1)])),_:1,__:[74]})):$("",!0)]),t("div",_t,[t("div",Yt,[e[76]||(e[76]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Tooltips",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[27]||(e[27]=n=>r(a)("code6"))},e[75]||(e[75]=[I('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),t("div",Ht,[t("form",{class:"space-y-5",onSubmit:e[35]||(e[35]=Y(n=>oe(),["prevent"]))},[t("div",Wt,[t("div",{class:O({"has-error":r(y).form6.firstName.$error,"has-success":V.value&&!r(y).form6.firstName.$error})},[e[77]||(e[77]=t("label",{for:"tlpFname"},"First Name",-1)),S(t("input",{id:"tlpFname",type:"text",placeholder:"Enter First Name",class:"form-input mb-2","onUpdate:modelValue":e[28]||(e[28]=n=>j.value.firstName=n)},null,512),[[z,j.value.firstName]]),V.value&&!r(y).form6.firstName.$error?(f(),h("span",Jt,"Looks Good!")):$("",!0),V.value&&r(y).form6.firstName.$error?(f(),h("span",Qt,"Please fill the first Name")):$("",!0)],2),t("div",{class:O({"has-error":r(y).form6.lastName.$error,"has-success":V.value&&!r(y).form6.lastName.$error})},[e[78]||(e[78]=t("label",{for:"tlpLname"},"Last name",-1)),S(t("input",{id:"tlpLname",type:"text",placeholder:"Enter Last Name",class:"form-input mb-2","onUpdate:modelValue":e[29]||(e[29]=n=>j.value.lastName=n)},null,512),[[z,j.value.lastName]]),V.value&&!r(y).form6.lastName.$error?(f(),h("span",Kt,"Looks Good!")):$("",!0),V.value&&r(y).form6.lastName.$error?(f(),h("span",Xt,"Please fill the last Name")):$("",!0)],2),t("div",{class:O({"has-error":r(y).form6.userName.$error,"has-success":V.value&&!r(y).form6.userName.$error})},[e[80]||(e[80]=t("label",{for:"tlpEmail"},"Username",-1)),t("div",er,[e[79]||(e[79]=t("div",{class:"flex items-center justify-center border border-[#e0e6ed] bg-[#eee] px-3 font-semibold ltr:rounded-l-md ltr:border-r-0 rtl:rounded-r-md rtl:border-l-0 dark:border-[#17263c] dark:bg-[#1b2e4b]"}," @ ",-1)),S(t("input",{id:"tlpEmail",type:"text",placeholder:"Enter Username",class:"form-input ltr:rounded-l-none rtl:rounded-r-none","onUpdate:modelValue":e[30]||(e[30]=n=>j.value.userName=n)},null,512),[[z,j.value.userName]])]),t("div",tr,[V.value&&!r(y).form6.userName.$error?(f(),h("span",rr,"Looks Good!")):$("",!0),V.value&&r(y).form6.userName.$error?(f(),h("span",sr,"Please choose a userName.")):$("",!0)])],2)]),t("div",or,[t("div",{class:O(["md:col-span-2",{"has-error":r(y).form6.city.$error,"has-success":V.value&&!r(y).form6.city.$error}])},[e[81]||(e[81]=t("label",{for:"tlpCity"},"City",-1)),S(t("input",{id:"tlpCity",type:"text",placeholder:"Enter City",class:"form-input mb-2","onUpdate:modelValue":e[31]||(e[31]=n=>j.value.city=n)},null,512),[[z,j.value.city]]),V.value&&!r(y).form6.city.$error?(f(),h("span",ar,"Looks Good!")):$("",!0),V.value&&r(y).form6.city.$error?(f(),h("span",lr,"Please provide a valid city.")):$("",!0)],2),t("div",{class:O({"has-error":r(y).form6.state.$error,"has-success":V.value&&!r(y).form6.state.$error})},[e[82]||(e[82]=t("label",{for:"tlpState"},"State",-1)),S(t("input",{id:"tlpState",type:"text",placeholder:"Enter State",class:"form-input mb-2","onUpdate:modelValue":e[32]||(e[32]=n=>j.value.state=n)},null,512),[[z,j.value.state]]),V.value&&!r(y).form6.state.$error?(f(),h("span",ir,"Looks Good!")):$("",!0),V.value&&r(y).form6.state.$error?(f(),h("span",nr,"Please provide a valid state.")):$("",!0)],2),t("div",{class:O({"has-error":r(y).form6.zip.$error,"has-success":V.value&&!r(y).form6.zip.$error})},[e[83]||(e[83]=t("label",{for:"tlpZip"},"Zip",-1)),S(t("input",{id:"tlpZip",type:"text",placeholder:"Enter Zip",class:"form-input mb-2","onUpdate:modelValue":e[33]||(e[33]=n=>j.value.zip=n)},null,512),[[z,j.value.zip]]),V.value&&!r(y).form6.zip.$error?(f(),h("span",mr,"Looks Good!")):$("",!0),V.value&&r(y).form6.zip.$error?(f(),h("span",ur,"Please provide a valid Zip.")):$("",!0)],2)]),t("div",{class:O({"has-error":r(y).form6.isTerms.$error,"has-success":V.value&&!r(y).form6.isTerms.$error})},[t("label",dr,[S(t("input",{type:"checkbox",class:"form-checkbox","onUpdate:modelValue":e[34]||(e[34]=n=>j.value.isTerms=n)},null,512),[[ae,j.value.isTerms]]),e[84]||(e[84]=t("span",{class:"text-white-dark"},"Agree to terms and conditions",-1))]),V.value&&r(y).form6.isTerms.$error?(f(),h("div",cr,e[85]||(e[85]=[t("span",{class:"rounded bg-danger py-1 px-2 text-white"},"You must agree before submitting.",-1)]))):$("",!0)],2),e[86]||(e[86]=t("button",{type:"submit",class:"btn btn-primary !mt-6"},"Submit Form",-1))],32)]),r(l).includes("code6")?(f(),_(W,{key:0},{default:H(()=>e[87]||(e[87]=[t("pre",null,`  <!-- tooltips -->
  <form class="space-y-5" @submit.prevent="submitForm6()">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div :class="{ 'has-error': $v6.form6.firstName.$error, 'has-success': isSubmitForm6 && !$v6.form6.firstName.$error }">
        <label for="tlpFname">First Name</label>
        <input id="tlpFname" type="text" placeholder="Enter First Name" class="form-input mb-2" v-model="form6.firstName" />
        <template v-if="isSubmitForm6 && !$v6.form6.firstName.$error">
          <span class="text-white bg-[#1abc9c] py-1 px-2 rounded">Looks Good!</span>
        </template>
        <template v-if="isSubmitForm6 && $v6.form6.firstName.$error">
          <span class="text-white bg-danger py-1 px-2 rounded">Please fill the first Name</span>
        </template>
      </div>
      <div :class="{ 'has-error': $v6.form6.lastName.$error, 'has-success': isSubmitForm6 && !$v6.form6.lastName.$error }">
        <label for="tlpLname">Last name</label>
        <input id="tlpLname" type="text" placeholder="Enter Last Name" class="form-input mb-2" v-model="form6.lastName" />
        <template v-if="isSubmitForm6 && !$v6.form6.lastName.$error">
          <span class="text-white bg-[#1abc9c] py-1 px-2 rounded">Looks Good!</span>
        </template>
        <template v-if="isSubmitForm6 && $v6.form6.lastName.$error">
          <span class="text-white bg-danger py-1 px-2 rounded">Please fill the last Name</span>
        </template>
      </div>
      <div :class="{ 'has-error': $v6.form6.userName.$error, 'has-success': isSubmitForm6 && !$v6.form6.userName.$error }">
        <label for="tlpEmail">Username</label>
        <div class="flex">
          <div
            class="
              bg-[#eee]
              flex
              justify-center
              items-center
              ltr:rounded-l-md
              rtl:rounded-r-md
              px-3
              font-semibold
              border
              ltr:border-r-0
              rtl:border-l-0
              border-[#e0e6ed]
              dark:border-[#17263c] dark:bg-[#1b2e4b]
            "
          >
            @
          </div>
          <input id="tlpEmail" type="text" placeholder="Enter Username" class="form-input ltr:rounded-l-none rtl:rounded-r-none" v-model="form6.userName" />
        </div>
        <div class="mt-2">
          <template v-if="isSubmitForm6 && !$v6.form6.userName.$error">
            <span class="text-white bg-[#1abc9c] py-1 px-2 rounded">Looks Good!</span>
          </template>
          <template v-if="isSubmitForm6 && $v6.form6.userName.$error">
            <span class="text-white bg-danger py-1 px-2 rounded">Please choose a userName.</span>
          </template>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-5">
      <div class="md:col-span-2" :class="{ 'has-error': $v6.form6.city.$error, 'has-success': isSubmitForm6 && !$v6.form6.city.$error }">
        <label for="tlpCity">City</label>
        <input id="tlpCity" type="text" placeholder="Enter City" class="form-input mb-2" v-model="form6.city" />
        <template v-if="isSubmitForm6 && !$v6.form6.city.$error">
          <span class="text-white bg-[#1abc9c] py-1 px-2 rounded">Looks Good!</span>
        </template>
        <template v-if="isSubmitForm6 && $v6.form6.city.$error">
          <span class="text-white bg-danger py-1 px-2 rounded">Please provide a valid city.</span>
        </template>
      </div>
      <div :class="{ 'has-error': $v6.form6.state.$error, 'has-success': isSubmitForm6 && !$v6.form6.state.$error }">
        <label for="tlpState">State</label>
        <input id="tlpState" type="text" placeholder="Enter State" class="form-input mb-2" v-model="form6.state" />
        <template v-if="isSubmitForm6 && !$v6.form6.state.$error">
          <span class="text-white bg-[#1abc9c] py-1 px-2 rounded">Looks Good!</span>
        </template>
        <template v-if="isSubmitForm6 && $v6.form6.state.$error">
          <span class="text-white bg-danger py-1 px-2 rounded">Please provide a valid state.</span>
        </template>
      </div>
      <div :class="{ 'has-error': $v6.form6.zip.$error, 'has-success': isSubmitForm6 && !$v6.form6.zip.$error }">
        <label for="tlpZip">Zip</label>
        <input id="tlpZip" type="text" placeholder="Enter Zip" class="form-input mb-2" v-model="form6.zip" />
        <template v-if="isSubmitForm6 && !$v6.form6.zip.$error">
          <span class="text-white bg-[#1abc9c] py-1 px-2 rounded">Looks Good!</span>
        </template>
        <template v-if="isSubmitForm6 && $v6.form6.zip.$error">
          <span class="text-white bg-danger py-1 px-2 rounded">Please provide a valid Zip.</span>
        </template>
      </div>
    </div>
    <div :class="{ 'has-error': $v6.form6.isTerms.$error, 'has-success': isSubmitForm6 && !$v6.form6.isTerms.$error }">
      <label class="flex items-center cursor-pointer">
        <input type="checkbox" class="form-checkbox" v-model="form6.isTerms" />
        <span class="text-white-dark">Agree to terms and conditions</span>
      </label>
      <template v-if="isSubmitForm6 && $v6.form6.isTerms.$error">
        <div class="mt-2">
          <span class="text-white bg-danger py-1 px-2 rounded">You must agree before submitting.</span>
        </div>
      </template>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit Form</button>
  </form>

  <!-- script -->
  <script lang="ts" setup>
    import { ref } from 'vue';
    import { useVuelidate } from '@vuelidate/core';
    import { required, email, sameAs } from '@vuelidate/validators';
    const form6 = ref({
      firstName: 'Shaun',
      lastName: 'Park',
      userName: '',
      city: '',
      state: '',
      zip: '',
      isTerms: false,
    });
    const isSubmitForm6 = ref(false);
    const rules6 = {
      form6: {
        firstName: { required },
        lastName: { required },
        userName: { required },
        city: { required },
        state: { required },
        zip: { required },
        isTerms: {
          sameAsRawValue: sameAs(true),
        },
      },
    };
    const $v6 = useVuelidate(rules6, { form6 });
    const submitForm6 = () => {
      isSubmitForm6.value = true;
      $v6.value.form6.$touch();
      if ($v6.value.form6.$invalid) {
        return false;
      }
      //form validated success
      showMessage('Form submitted successfully.');
    };
  <\/script>
  `,-1)])),_:1,__:[87]})):$("",!0)])])])]))}});export{$r as default};
