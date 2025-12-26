import{d as u,u as f,o as v,af as g,h as w,k as t,q as l,c as r,s as n,v as i,b as c,g as s}from"./Cs8kveBG.js";import{c as _,h as p}from"./Bykx_eDL.js";import"./92s3wAHG.js";const h={class:"space-y-8 pt-5"},b={class:"grid grid-cols-1 gap-6 lg:grid-cols-2"},k={class:"panel"},y={class:"mb-5 flex items-center justify-between"},C={class:"panel"},x={class:"mb-5 flex items-center justify-between"},U=u({__name:"file-upload",setup(I){f({title:"File Upload"});const{codeArr:a,toggleCode:o}=_();return v(async()=>{let e=(await g(()=>import("./rUdp_L9r.js"),[],import.meta.url)).default;new e("myFirstImage",{images:{baseImage:"/assets/images/file-preview.svg",backgroundImage:""}}),new e("mySecondImage",{images:{baseImage:"/assets/images/file-preview.svg",backgroundImage:""},multiple:!0})}),(d,e)=>(s(),w("div",null,[e[11]||(e[11]=t("ul",{class:"flex space-x-2 rtl:space-x-reverse"},[t("li",null,[t("a",{href:"javascript:;",class:"text-primary hover:underline"},"Forms")]),t("li",{class:"before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"},[t("span",null,"File Upload")])],-1)),t("div",h,[e[10]||(e[10]=l('<div class="panel flex items-center overflow-x-auto whitespace-nowrap p-3 text-primary"><div class="rounded-full bg-primary p-1.5 text-white ring-2 ring-primary/30 ltr:mr-3 rtl:ml-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5"><path d="M19.0001 9.7041V9C19.0001 5.13401 15.8661 2 12.0001 2C8.13407 2 5.00006 5.13401 5.00006 9V9.7041C5.00006 10.5491 4.74995 11.3752 4.28123 12.0783L3.13263 13.8012C2.08349 15.3749 2.88442 17.5139 4.70913 18.0116C9.48258 19.3134 14.5175 19.3134 19.291 18.0116C21.1157 17.5139 21.9166 15.3749 20.8675 13.8012L19.7189 12.0783C19.2502 11.3752 19.0001 10.5491 19.0001 9.7041Z" stroke="currentColor" stroke-width="1.5"></path><path opacity="0.5" d="M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></div><span class="ltr:mr-3 rtl:ml-3">Documentation: </span><a href="https://www.npmjs.com/package/file-upload-with-preview" target="_blank" class="block hover:underline"> https://www.npmjs.com/package/file-upload-with-preview </a></div>',1)),t("div",b,[t("div",k,[t("div",y,[e[3]||(e[3]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Single File Upload",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[0]||(e[0]=m=>i(o)("code1"))},e[2]||(e[2]=[l('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e[5]||(e[5]=l('<div class="mb-5"><div class="custom-file-container" data-upload-id="myFirstImage"><div class="label-container"><label>Upload </label> <a href="javascript:;" class="custom-file-container__image-clear" title="Clear Image">×</a></div><label class="custom-file-container__custom-file"><input type="file" class="custom-file-container__custom-file__custom-file-input" accept="image/*"><input type="hidden" name="MAX_FILE_SIZE" value="10485760"><span class="custom-file-container__custom-file__custom-file-control ltr:pr-20 rtl:pl-20"></span></label><div class="custom-file-container__image-preview"></div></div></div>',1)),i(a).includes("code1")?(s(),r(p,{key:0},{default:c(()=>e[4]||(e[4]=[t("pre",null,`  <!-- single file -->
  <div class="custom-file-container" data-upload-id="myFirstImage">
    <div class="label-container"><label>Upload </label> <a href="javascript:;" class="custom-file-container__image-clear" title="Clear Image">×</a></div>
    <label class="custom-file-container__custom-file">
      <input type="file" class="custom-file-container__custom-file__custom-file-input" accept="image/*" />
      <input type="hidden" name="MAX_FILE_SIZE" value="10485760" />
      <span class="custom-file-container__custom-file__custom-file-control ltr:pr-20 rtl:pl-20"></span>
    </label>
    <div class="custom-file-container__image-preview"></div>
  </div>

  <!-- script -->
  <script lang="ts" setup>
    import { onMounted } from 'vue';
    import FileUploadWithPreview from 'file-upload-with-preview';
    import 'file-upload-with-preview/dist/style.css';
    import '../../assets/css/file-upload-with-preview.min.css';

    onMounted(() => {
      // single image upload
      new FileUploadWithPreview('myFirstImage', {
        images: {
          baseImage: '/assets/images/file-preview.svg',
          backgroundImage: '',
        },
      });
    });
  <\/script>
  `,-1)])),_:1,__:[4]})):n("",!0)]),t("div",C,[t("div",x,[e[7]||(e[7]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Multiple File",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[1]||(e[1]=m=>i(o)("code2"))},e[6]||(e[6]=[l('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e[9]||(e[9]=l('<div class="mb-5"><div class="custom-file-container" data-upload-id="mySecondImage"><div class="label-container"><label>Upload </label> <a href="javascript:;" class="custom-file-container__image-clear" title="Clear Image">×</a></div><label class="custom-file-container__custom-file"><input type="file" class="custom-file-container__custom-file__custom-file-input" multiple><input type="hidden" name="MAX_FILE_SIZE" value="10485760"><span class="custom-file-container__custom-file__custom-file-control ltr:pr-20 rtl:pl-20"></span></label><div class="custom-file-container__image-preview"></div></div></div>',1)),i(a).includes("code2")?(s(),r(p,{key:0},{default:c(()=>e[8]||(e[8]=[t("pre",null,`  <!-- multiple file -->
  <div class="custom-file-container" data-upload-id="mySecondImage">
    <div class="label-container"><label>Upload </label> <a href="javascript:;" class="custom-file-container__image-clear" title="Clear Image">×</a></div>
    <label class="custom-file-container__custom-file">
      <input type="file" class="custom-file-container__custom-file__custom-file-input" multiple />
      <input type="hidden" name="MAX_FILE_SIZE" value="10485760" />
      <span class="custom-file-container__custom-file__custom-file-control ltr:pr-20 rtl:pl-20"></span>
    </label>
    <div class="custom-file-container__image-preview"></div>
  </div>

  <!-- script -->
  <script lang="ts" setup>
    import { onMounted } from 'vue';
    import FileUploadWithPreview from 'file-upload-with-preview';
    import 'file-upload-with-preview/dist/style.css';
    import '../../assets/css/file-upload-with-preview.min.css';

    onMounted(() => {
      // multiple image upload
      new FileUploadWithPreview('mySecondImage', {
        images: {
          baseImage: '/assets/images/file-preview.svg',
          backgroundImage: '',
        },
        multiple: true,
      });
    });
  <\/script>
  `,-1)])),_:1,__:[8]})):n("",!0)])])])]))}});export{U as default};
