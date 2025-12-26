import{c,h as o}from"./Bykx_eDL.js";import{d as b,u,h as f,k as t,q as s,c as a,s as d,v as l,b as p,g as r}from"./Cs8kveBG.js";import"./92s3wAHG.js";const v={class:"grid grid-cols-1 gap-6 pt-5 lg:grid-cols-2"},x={class:"panel"},h={class:"mb-5 flex items-center justify-between"},w={class:"panel"},k={class:"mb-5 flex items-center justify-between"},y={class:"panel"},g={class:"mb-5 flex items-center justify-between"},C={class:"panel"},E={class:"mb-5 flex items-center justify-between"},L={class:"panel"},P={class:"mb-5 flex items-center justify-between"},S={class:"panel lg:col-span-2"},A={class:"mb-5 flex items-center justify-between"},M={class:"panel lg:col-span-2"},j={class:"mb-5 flex items-center justify-between"},F={class:"panel lg:col-start-2 lg:row-start-3"},B={class:"mb-5 flex items-center justify-between"},$=b({__name:"layouts",setup(N){u({title:"Form Layouts"});const{codeArr:i,toggleCode:n}=c();return(z,e)=>(r(),f("div",null,[e[40]||(e[40]=t("ul",{class:"flex space-x-2 rtl:space-x-reverse"},[t("li",null,[t("a",{href:"javascript:;",class:"text-primary hover:underline"},"Forms")]),t("li",{class:"before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"},[t("span",null,"Layouts")])],-1)),t("div",v,[t("div",x,[t("div",h,[e[9]||(e[9]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Stack Forms",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[0]||(e[0]=m=>l(n)("code1"))},e[8]||(e[8]=[s('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e[11]||(e[11]=s('<div class="mb-5"><form class="space-y-5"><div><input type="email" placeholder="Enter Email" class="form-input"><span class="mt-1 inline-block text-[11px] text-white-dark">We&#39;ll never share your email with anyone else.</span></div><div><input type="password" placeholder="Enter Password" class="form-input"></div><div><label class="mt-1 inline-flex cursor-pointer items-center"><input type="checkbox" class="form-checkbox"><span class="text-white-dark">Subscribe to weekly newsletter</span></label></div><button type="submit" class="btn btn-primary !mt-6">Submit</button></form></div>',1)),l(i).includes("code1")?(r(),a(o,{key:0},{default:p(()=>e[10]||(e[10]=[t("pre",null,`<!-- stack forms -->
<form class="space-y-5">
    <div>
        <input type="email" placeholder="Enter Email" class="form-input" />
        <span class="text-white-dark text-[11px] inline-block mt-1">We'll never share your email with anyone else.</span>
    </div>
    <div>
        <input type="password" placeholder="Enter Password" class="form-input" />
    </div>
    <div>
        <label class="inline-flex items-center mt-1 cursor-pointer">
            <input type="checkbox" class="form-checkbox" />
            <span class="text-white-dark"">Subscribe to weekly newsletter</span>
        </label>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit</button>
</form>
`,-1)])),_:1,__:[10]})):d("",!0)]),t("div",w,[t("div",k,[e[13]||(e[13]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Horizontal form",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[1]||(e[1]=m=>l(n)("code2"))},e[12]||(e[12]=[s('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e[15]||(e[15]=s('<div class="mb-5"><form class="space-y-5"><div class="flex flex-col sm:flex-row"><label for="horizontalEmail" class="mb-0 rtl:ml-2 sm:w-1/4 sm:ltr:mr-2">Email</label><input id="horizontalEmail" type="email" placeholder="Enter Email" class="form-input flex-1"></div><div class="flex flex-col sm:flex-row"><label for="horizontalPassword" class="mb-0 rtl:ml-2 sm:w-1/4 sm:ltr:mr-2">Password</label><input id="horizontalPassword" type="password" placeholder="Enter Password" class="form-input flex-1"></div><div class="flex flex-col sm:flex-row"><label class="rtl:ml-2 sm:w-1/4 sm:ltr:mr-2">Choose Segements</label><div class="flex-1"><div class="mb-2"><label class="mt-1 inline-flex cursor-pointer"><input type="radio" name="segements" class="form-radio"><span class="text-white-dark">Segements 1</span></label></div><div class="mb-2"><label class="mt-1 inline-flex cursor-pointer"><input type="radio" name="segements" class="form-radio"><span class="text-white-dark">Segements 2</span></label></div><div><label class="mt-1 inline-flex"><input type="radio" name="segements" class="form-radio" disabled><span class="text-white-dark">Segements 3 ( disabled )</span></label></div></div></div><div class="flex flex-col sm:flex-row"><label class="font-semibold rtl:ml-2 sm:w-1/4 sm:ltr:mr-2">Apply</label><label class="mb-0 inline-flex cursor-pointer"><input type="checkbox" class="form-checkbox"><span class="text-white-dark">Terms Conditions</span></label></div><button type="submit" class="btn btn-primary !mt-6">Submit</button></form></div>',1)),l(i).includes("code2")?(r(),a(o,{key:0},{default:p(()=>e[14]||(e[14]=[t("pre",null,`<!-- horizontal form -->
<form class="space-y-5">
    <div class="flex sm:flex-row flex-col">
        <label for="horizontalEmail" class="mb-0 sm:w-1/4 sm:ltr:mr-2 rtl:ml-2">Email</label>
        <input id="horizontalEmail" type="email" placeholder="Enter Email" class="form-input flex-1" />
    </div>
    <div class="flex sm:flex-row flex-col">
        <label for="horizontalPassword" class="mb-0 sm:w-1/4 sm:ltr:mr-2 rtl:ml-2">Password</label>
        <input id="horizontalPassword" type="password" placeholder="Enter Password" class="form-input flex-1" />
    </div>
    <div class="flex sm:flex-row flex-col">
        <label class="sm:w-1/4 sm:ltr:mr-2 rtl:ml-2">Choose Segements</label>
        <div class="flex-1">
            <div class="mb-2">
                <label class="inline-flex mt-1 cursor-pointer">
                    <input type="radio" name="segements" class="form-radio" />
                    <span class="text-white-dark"">Segements 1</span>
                </label>
            </div>
            <div class="mb-2">
                <label class="inline-flex mt-1 cursor-pointer">
                    <input type="radio" name="segements" class="form-radio" />
                    <span class="text-white-dark"">Segements 2</span>
                </label>
            </div>
            <div>
                <label class="inline-flex mt-1">
                    <input type="radio" name="segements" class="form-radio" disabled />
                    <span class="text-white-dark"">Segements 3 ( disabled )</span>
                </label>
            </div>
        </div>
    </div>
    <div class="flex sm:flex-row flex-col">
        <label class="font-semibold text-white-dark sm:w-1/4 sm:ltr:mr-2 rtl:ml-2">Apply</label>
        <label class="inline-flex mb-0 cursor-pointer">
            <input type="checkbox" class="form-checkbox" />
            <span class="text-white-dark" relative">Terms Conditions</span>
        </label>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit</button>
</form>
`,-1)])),_:1,__:[14]})):d("",!0)]),t("div",y,[t("div",g,[e[17]||(e[17]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Registration Forms",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[2]||(e[2]=m=>l(n)("code3"))},e[16]||(e[16]=[s('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e[19]||(e[19]=s('<div class="mb-5"><form class="space-y-5"><div><input type="email" placeholder="Enter Email Address *" class="form-input"></div><div><input type="password" placeholder="Enter Password *" class="form-input"></div><div><input type="password" placeholder="Enter Confirm Password *" class="form-input"></div><div class="!mt-2"><span class="inline-block text-[11px] text-white-dark">*Required Fields</span></div><div><label class="inline-flex cursor-pointer"><input type="checkbox" class="form-checkbox"><span class="text-white-dark">Subscribe to weekly newsletter</span></label></div><button type="submit" class="btn btn-primary !mt-6">Submit</button></form></div>',1)),l(i).includes("code3")?(r(),a(o,{key:0},{default:p(()=>e[18]||(e[18]=[t("pre",null,`<!-- registration form -->
<form class="space-y-5">
    <div>
        <input type="email" placeholder="Enter Email Address *" class="form-input" />
    </div>
    <div>
        <input type="password" placeholder="Enter Password *" class="form-input" />
    </div>
    <div>
        <input type="password" placeholder="Enter Confirm Password *" class="form-input" />
    </div>
    <div class="!mt-2">
        <span class="text-white-dark text-[11px] inline-block">*Required Fields</span>
    </div>
    <div>
        <label class="inline-flex cursor-pointer">
            <input type="checkbox" class="form-checkbox" />
            <span class="text-white-dark"">Subscribe to weekly newsletter</span>
        </label>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit</button>
</form>
`,-1)])),_:1,__:[18]})):d("",!0)]),t("div",C,[t("div",E,[e[21]||(e[21]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Login Forms",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[3]||(e[3]=m=>l(n)("code4"))},e[20]||(e[20]=[s('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e[23]||(e[23]=s('<div class="mb-5"><form class="space-y-5"><div><input type="text" placeholder="Enter Full Name *" class="form-input"></div><div><input type="email" placeholder="Enter Email Address *" class="form-input"></div><div><input type="password" placeholder="Enter Password *" class="form-input"></div><div class="!mt-2"><span class="inline-block text-[11px] text-white-dark">*Required Fields</span></div><button type="submit" class="btn btn-primary !mt-6">Submit</button></form></div>',1)),l(i).includes("code4")?(r(),a(o,{key:0},{default:p(()=>e[22]||(e[22]=[t("pre",null,`<!-- login form -->
<form class="space-y-5">
    <div>
        <input type="text" placeholder="Enter Full Name *" class="form-input" />
    </div>
    <div>
        <input type="email" placeholder="Enter Email address *" class="form-input" />
    </div>
    <div>
        <input type="password" placeholder="Enter Password *" class="form-input" />
    </div>
    <div class="!mt-2">
        <span class="text-white-dark text-[11px] inline-block">*Required Fields</span>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit</button>
</form>
`,-1)])),_:1,__:[22]})):d("",!0)]),t("div",L,[t("div",P,[e[25]||(e[25]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Forms Grid",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[4]||(e[4]=m=>l(n)("code5"))},e[24]||(e[24]=[s('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e[27]||(e[27]=s('<div class="mb-5"><form class="space-y-5"><div class="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label for="gridEmail">Email</label><input id="gridEmail" type="email" placeholder="Enter Email" class="form-input"></div><div><label for="gridPassword">Password</label><input id="gridPassword" type="Password" placeholder="Enter Password" class="form-input"></div></div><div><label for="gridAddress1">Address</label><input id="gridAddress1" type="text" placeholder="Enter Address" value="1234 Main St" class="form-input"></div><div><label for="gridAddress2">Address2</label><input id="gridAddress2" type="text" placeholder="Enter Address2" value="Apartment, studio, or floor" class="form-input"></div><div class="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4"><div class="md:col-span-2"><label for="gridCity">City</label><input id="gridCity" type="text" placeholder="Enter City" class="form-input"></div><div><label for="gridState">State</label><select id="gridState" class="form-select text-white-dark"><option>Choose...</option><option>...</option></select></div><div><label for="gridZip">Zip</label><input id="gridZip" type="text" placeholder="Enter Zip" class="form-input"></div></div><div><label class="mt-1 flex cursor-pointer items-center"><input type="checkbox" class="form-checkbox"><span class="text-white-dark">Check me out</span></label></div><button type="submit" class="btn btn-primary !mt-6">Submit</button></form></div>',1)),l(i).includes("code5")?(r(),a(o,{key:0},{default:p(()=>e[26]||(e[26]=[t("pre",null,`<!-- forms grid -->
<form class="space-y-5">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
            <label for="gridEmail">Email</label>
            <input id="gridEmail" type="email" placeholder="Enter Email" class="form-input" />
        </div>
        <div>
            <label for="gridPassword">Password</label>
            <input id="gridPassword" type="Password" placeholder="Enter Password" class="form-input" />
        </div>
    </div>
    <div>
        <label for="gridAddress1">Address</label>
        <input id="gridAddress1" type="text" placeholder="Enter Address" value="1234 Main St" class="form-input" />
    </div>
    <div>
        <label for="gridAddress2">Address2</label>
        <input id="gridAddress2" type="text" placeholder="Enter Address2" value="Apartment, studio, or floor" class="form-input" />
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div class="md:col-span-2">
            <label for="gridCity">City</label>
            <input id="gridCity" type="text" placeholder="Enter City" class="form-input" />
        </div>
        <div>
            <label for="gridState">State</label>
            <select id="gridState" class="form-select text-white-dark">
                <option>Choose...</option>
                <option>...</option>
            </select>
        </div>
        <div>
            <label for="gridZip">Zip</label>
            <input id="gridZip" type="text" placeholder="Enter Zip" class="form-input" />
        </div>
    </div>
    <div>
        <label class="flex items-center mt-1 cursor-pointer">
            <input type="checkbox" class="form-checkbox" />
            <span class="text-white-dark"">Check me out</span>
        </label>
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit</button>
</form>
`,-1)])),_:1,__:[26]})):d("",!0)]),t("div",S,[t("div",A,[e[29]||(e[29]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Inline Forms",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[5]||(e[5]=m=>l(n)("code6"))},e[28]||(e[28]=[s('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e[31]||(e[31]=s('<div class="mb-5"><form><div class="mx-auto flex max-w-[900px] flex-col items-center gap-4 md:flex-row"><input type="email" placeholder="Jane Doe" class="form-input flex-1"><div class="flex flex-1"><div class="flex items-center justify-center border border-[#e0e6ed] bg-[#eee] px-3 font-semibold ltr:rounded-l-md ltr:border-r-0 rtl:rounded-r-md rtl:border-l-0 dark:border-[#17263c] dark:bg-[#1b2e4b]"> @ </div><input type="text" placeholder="Username" class="form-input ltr:rounded-l-none rtl:rounded-r-none"></div><div><label class="flex items-center"><input type="checkbox" class="form-checkbox"><span class="text-white-dark">Remember me</span></label></div><button type="submit" class="btn btn-primary py-2.5">Submit</button></div></form></div>',1)),l(i).includes("code6")?(r(),a(o,{key:0},{default:p(()=>e[30]||(e[30]=[t("pre",null,`<!-- inline form -->
<form>
    <div class="flex flex-col md:flex-row gap-4 items-center max-w-[900px] mx-auto">
        <input type="email" placeholder="Jane Doe" class="form-input flex-1" />
        <div class="flex flex-1">
            <div class="bg-[#eee] flex justify-center items-center ltr:rounded-l-md rtl:rounded-r-md px-3 font-semibold border ltr:border-r-0 rtl:border-l-0 border-[#e0e6ed] dark:border-[#17263c] dark:bg-[#1b2e4b]">@</div>
            <input type="text" placeholder="Username" class="form-input ltr:rounded-l-none rtl:rounded-r-none" />
        </div>
        <div>
            <label class="flex items-center">
                <input type="checkbox" class="form-checkbox" />
                <span class="text-white-dark">Remember me</span>
            </label>
        </div>
        <button type="submit" class="btn btn-primary py-2.5">Submit</button>
    </div>
</form>
`,-1)])),_:1,__:[30]})):d("",!0)]),t("div",M,[t("div",j,[e[33]||(e[33]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Auto-sizing",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[6]||(e[6]=m=>l(n)("code7"))},e[32]||(e[32]=[s('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e[35]||(e[35]=s('<div class="mb-5"><form><div class="mx-auto flex max-w-[900px] flex-col items-center gap-4 md:flex-row"><input type="email" placeholder="Jane Doe" class="form-input flex-1"><div class="flex flex-1"><div class="flex items-center justify-center border border-[#e0e6ed] bg-[#eee] px-3 font-semibold ltr:rounded-l-md ltr:border-r-0 rtl:rounded-r-md rtl:border-l-0 dark:border-[#17263c] dark:bg-[#1b2e4b]"> @ </div><input type="text" placeholder="Username" class="form-input ltr:rounded-l-none rtl:rounded-r-none"></div><div><label class="flex cursor-pointer items-center"><input type="checkbox" class="form-checkbox"><span class="text-white-dark">Remember me</span></label></div><button type="submit" class="btn btn-primary py-2.5">Submit</button></div></form></div>',1)),l(i).includes("code7")?(r(),a(o,{key:0},{default:p(()=>e[34]||(e[34]=[t("pre",null,`<!-- auto sizing-->
<form>
<div class="flex flex-col md:flex-row gap-4 items-center max-w-[900px] mx-auto">
    <input type="email" placeholder="Jane Doe" class="form-input flex-1" />
    <div class="flex flex-1">
        <div class="bg-[#eee] flex justify-center items-center ltr:rounded-l-md rtl:rounded-r-md px-3 font-semibold border ltr:border-r-0 rtl:border-l-0 border-[#e0e6ed] dark:border-[#17263c] dark:bg-[#1b2e4b]">@</div>
        <input type="text" placeholder="Username" class="form-input ltr:rounded-l-none rtl:rounded-r-none" />
    </div>
    <div>
        <label class="flex items-center cursor-pointer">
            <input type="checkbox" class="form-checkbox" />
            <span class="text-white-dark">Remember me</span>
        </label>
    </div>
    <button type="submit" class="btn btn-primary py-2.5">Submit</button>
</div>
</form>
`,-1)])),_:1,__:[34]})):d("",!0)]),t("div",F,[t("div",B,[e[37]||(e[37]=t("h5",{class:"text-lg font-semibold dark:text-white-light"},"Actions Buttons",-1)),t("a",{class:"font-semibold hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-600",href:"javascript:;",onClick:e[7]||(e[7]=m=>l(n)("code8"))},e[36]||(e[36]=[s('<span class="flex items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ltr:mr-2 rtl:ml-2"><path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path opacity="0.5" d="M13.9868 5L10.0132 19.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Code </span>',1)]))]),e[39]||(e[39]=s('<div class="mb-5"><form class="space-y-5"><div><label for="actionName">Full Name:</label><input id="actionName" type="text" placeholder="Enter Full Name" class="form-input"></div><div><label for="actionEmail">Email:</label><div class="flex flex-1"><div class="flex items-center justify-center border border-[#e0e6ed] bg-[#eee] px-3 font-semibold ltr:rounded-l-md ltr:border-r-0 rtl:rounded-r-md rtl:border-l-0 dark:border-[#17263c] dark:bg-[#1b2e4b]"> @ </div><input id="actionEmail" type="email" placeholder="" class="form-input ltr:rounded-l-none rtl:rounded-r-none"></div></div><div><label for="actionWeb">Website:</label><input id="actionWeb" type="text" placeholder="https://" class="form-input"></div><div><label for="actionPassword">Password:</label><input id="actionPassword" type="password" placeholder="Enter Password" class="form-input"></div><div><label for="actionCpass">Confirm Password:</label><input id="actionCpass" type="password" placeholder="Enter Confirm Password" class="form-input"></div><button type="submit" class="btn btn-primary !mt-6">Submit</button></form></div>',1)),l(i).includes("code8")?(r(),a(o,{key:0},{default:p(()=>e[38]||(e[38]=[t("pre",null,`<!-- action button -->
<form class="space-y-5">
    <div>
        <label for="actionName">Full Name:</label>
        <input id="actionName" type="text" placeholder="Enter Full Name" class="form-input" />
    </div>
    <div>
        <label for="actionEmail">Email:</label>
        <div class="flex flex-1">
            <div class="bg-[#eee] flex justify-center items-center ltr:rounded-l-md rtl:rounded-r-md px-3 font-semibold border ltr:border-r-0 rtl:border-l-0 border-[#e0e6ed] dark:border-[#17263c] dark:bg-[#1b2e4b]">@</div>
            <input id="actionEmail" type="email" placeholder="" class="form-input ltr:rounded-l-none rtl:rounded-r-none" />
        </div>
    </div>
    <div>
        <label for="actionWeb">Website:</label>
        <input id="actionWeb" type="text" placeholder="https://" class="form-input" />
    </div>
    <div>
        <label for="actionPassword">Password:</label>
        <input id="actionPassword" type="password" placeholder="Enter Password" class="form-input" />
    </div>
    <div>
        <label for="actionCpass">Confirm Password:</label>
        <input id="actionCpass" type="password" placeholder="Enter Confirm Password" class="form-input" />
    </div>
    <button type="submit" class="btn btn-primary !mt-6">Submit</button>
</form>
`,-1)])),_:1,__:[38]})):d("",!0)])])]))}});export{$ as default};
