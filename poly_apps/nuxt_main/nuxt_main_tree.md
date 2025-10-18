# Directory Tree: nuxt_main

**Path:** `D:\programing\core_node\poly_apps\nuxt_main`

```
nuxt_main/
├── assets/
│   └── css/
│       ├── animate.css
│       ├── app.css
│       ├── datatable.css
│       ├── dragndrop.css
│       ├── file-upload-preview.css
│       ├── file-upload-with-preview.min.css
│       ├── flatpickr.css
│       ├── form-elements.css
│       ├── fullcalendar.css
│       ├── lightbox.css
│       ├── markdown-editor.css
│       ├── quill-editor.css
│       ├── range-slider.css
│       ├── scrumboard.css
│       ├── select2.css
│       ├── sweetalert.css
│       ├── sweetalert2.css
│       ├── swiper.css
│       ├── tailwind.css
│       ├── tippy.css
│       └── wizard.css
├── codemart_doc/
│   ├── codemart.md
│   └── index.md
├── components/
│   ├── codemart/
│   │   └── CodemartSidebar.vue
│   ├── layout/
│   │   ├── Footer.vue
│   │   ├── Header.vue
│   │   └── Sidebar.vue
│   ├── plugins/
│   │   ├── QuillEditor.vue
│   │   └── highlight.vue
│   ├── shared/
│   │   ├── dashboard/
│   │   │   ├── ProgressChart.vue
│   │   │   ├── StatCard.vue
│   │   │   └── WelcomeCard.vue
│   │   ├── layout/
│   │   │   └── MainHeader.vue
│   │   └── ui/
│   │       └── DataTable.vue
│   ├── subsite-admin/
│   │   └── AdminSidebar.vue
│   └── ThemeCustomizer.vue
├── composables/
│   ├── codePreview.ts
│   ├── useAppTheme.ts
│   ├── useAuth.ts
│   ├── useCharts.ts
│   ├── useDashboard.ts
│   ├── useDataSource.ts
│   ├── useNuxtApi.ts
│   ├── useRoles.ts
│   ├── useRouteNamespace.ts
│   ├── useTables.ts
│   └── useVueQuery.ts
├── configs/
│   ├── codemart-menu.ts
│   ├── codemart.config.ts
│   ├── dashboard.config.ts
│   ├── dev.config.ts
│   ├── example.config.ts
│   ├── mainsite.config.ts
│   └── subsite-admin.config.ts
├── constants/
│   ├── apps/
│   │   ├── admin-constants.ts
│   │   └── codemart-constants.ts
│   └── base-constants.ts
├── docs/
│   └── DATASOURCE_ARCHITECTURE.md
├── i18n/
│   └── locales/
│       ├── da.json
│       ├── de.json
│       ├── el.json
│       ├── en.json
│       ├── es.json
│       ├── fr.json
│       ├── hu.json
│       ├── it.json
│       ├── ja.json
│       ├── pl.json
│       ├── pt.json
│       ├── ru.json
│       ├── sv.json
│       ├── tr.json
│       └── zh.json
├── layouts/
│   ├── auth-layout.vue
│   ├── codemart-layout.vue
│   └── default.vue
├── middleware/
│   └── app-entry.global.ts
├── pages/
│   ├── admin/
│   │   └── datasources.vue
│   ├── apps/
│   │   ├── invoice/
│   │   │   ├── add.vue
│   │   │   ├── edit.vue
│   │   │   ├── list.vue
│   │   │   └── preview.vue
│   │   ├── calendar.vue
│   │   ├── chat.vue
│   │   ├── contacts.vue
│   │   ├── mailbox.vue
│   │   ├── notes.vue
│   │   ├── scrumboard.vue
│   │   └── todolist.vue
│   ├── auth/
│   │   ├── boxed-lockscreen.vue
│   │   ├── boxed-password-reset.vue
│   │   ├── boxed-signin.vue
│   │   ├── boxed-signup.vue
│   │   ├── cover-lockscreen.vue
│   │   ├── cover-login.vue
│   │   ├── cover-password-reset.vue
│   │   └── cover-register.vue
│   ├── components/
│   │   ├── accordions.vue
│   │   ├── cards.vue
│   │   ├── carousel.vue
│   │   ├── countdown.vue
│   │   ├── counter.vue
│   │   ├── lightbox.vue
│   │   ├── list-group.vue
│   │   ├── media-object.vue
│   │   ├── modals.vue
│   │   ├── notifications.vue
│   │   ├── pricing-table.vue
│   │   ├── sweetalert.vue
│   │   ├── tabs.vue
│   │   └── timeline.vue
│   ├── datatables/
│   │   ├── advanced.vue
│   │   ├── alt-pagination.vue
│   │   ├── basic.vue
│   │   ├── checkbox.vue
│   │   ├── clone-header.vue
│   │   ├── column-chooser.vue
│   │   ├── columns-filter.vue
│   │   ├── export.vue
│   │   ├── multi-column.vue
│   │   ├── multiple-tables.vue
│   │   ├── order-sorting.vue
│   │   ├── range-search.vue
│   │   ├── skin.vue
│   │   └── sticky-header.vue
│   ├── elements/
│   │   ├── alerts.vue
│   │   ├── avatar.vue
│   │   ├── badges.vue
│   │   ├── breadcrumbs.vue
│   │   ├── buttons-group.vue
│   │   ├── buttons.vue
│   │   ├── color-library.vue
│   │   ├── dropdown.vue
│   │   ├── infobox.vue
│   │   ├── jumbotron.vue
│   │   ├── loader.vue
│   │   ├── pagination.vue
│   │   ├── popovers.vue
│   │   ├── progress-bar.vue
│   │   ├── search.vue
│   │   ├── tooltips.vue
│   │   ├── treeview.vue
│   │   └── typography.vue
│   ├── examples/
│   │   └── datasource-demo.vue
│   ├── forms/
│   │   ├── basic.vue
│   │   ├── checkbox-radio.vue
│   │   ├── clipboard.vue
│   │   ├── date-picker.vue
│   │   ├── file-upload.vue
│   │   ├── input-group.vue
│   │   ├── input-mask.vue
│   │   ├── layouts.vue
│   │   ├── markdown-editor.vue
│   │   ├── quill-editor.vue
│   │   ├── select2.vue
│   │   ├── switches.vue
│   │   ├── touchspin.vue
│   │   ├── validation.vue
│   │   └── wizards.vue
│   ├── pages/
│   │   ├── coming-soon.vue
│   │   ├── contact-us.vue
│   │   ├── error404.vue
│   │   ├── error500.vue
│   │   ├── error503.vue
│   │   ├── faq.vue
│   │   ├── knowledge-base.vue
│   │   └── maintenence.vue
│   ├── users/
│   │   ├── profile.vue
│   │   └── user-account-settings.vue
│   ├── analytics.vue
│   ├── charts.vue
│   ├── codemart-dashboard.vue
│   ├── crypto.vue
│   ├── datasources-admin.vue
│   ├── dev-code-editor.vue
│   ├── dev-dashboard.vue
│   ├── dragndrop.vue
│   ├── finance.vue
│   ├── font-icons.vue
│   ├── index-example.vue
│   ├── index.admin.vue
│   ├── index.codemart.vue
│   ├── index.dashboard.vue
│   ├── index.dev.vue
│   ├── index.example.vue
│   ├── index.vue
│   ├── mainsite-dashboard.vue
│   ├── tables.vue
│   └── widgets.vue
├── plugins/
│   ├── datasource.client.ts
│   ├── maska.ts
│   ├── perfect-scrollbar.ts
│   ├── theme.client.ts
│   ├── tippy.ts
│   ├── vue-easymde.ts
│   ├── vue3-apexcharts.ts
│   ├── vue3-json-excel.ts
│   └── vue3-popper.ts
├── public/
│   ├── assets/
│   │   └── images/
│   │       ├── flags/
│   │       │   ├── AC.svg
│   │       │   ├── AD.svg
│   │       │   ├── AE.svg
│   │       │   ├── AF.svg
│   │       │   ├── AG.svg
│   │       │   ├── AI.svg
│   │       │   ├── AL.svg
│   │       │   ├── AM.svg
│   │       │   ├── AO.svg
│   │       │   ├── AR.svg
│   │       │   ├── AS.svg
│   │       │   ├── AT.svg
│   │       │   ├── AU.svg
│   │       │   ├── AW.svg
│   │       │   ├── AX.svg
│   │       │   ├── AZ.svg
│   │       │   ├── BA.svg
│   │       │   ├── BB.svg
│   │       │   ├── BD.svg
│   │       │   ├── BE.svg
│   │       │   ├── BF.svg
│   │       │   ├── BG.svg
│   │       │   ├── BH.svg
│   │       │   ├── BI.svg
│   │       │   ├── BJ.svg
│   │       │   ├── BL.svg
│   │       │   ├── BM.svg
│   │       │   ├── BN.svg
│   │       │   ├── BO.svg
│   │       │   ├── BR.svg
│   │       │   ├── BS.svg
│   │       │   ├── BT.svg
│   │       │   ├── BV.svg
│   │       │   ├── BW.svg
│   │       │   ├── BY.svg
│   │       │   ├── BZ.svg
│   │       │   ├── CA.svg
│   │       │   ├── CC.svg
│   │       │   ├── CD.svg
│   │       │   ├── CF.svg
│   │       │   ├── CG.svg
│   │       │   ├── CH.svg
│   │       │   ├── CI.svg
│   │       │   ├── CK.svg
│   │       │   ├── CL.svg
│   │       │   ├── CM.svg
│   │       │   ├── CN.svg
│   │       │   ├── CO.svg
│   │       │   ├── CR.svg
│   │       │   ├── CU.svg
│   │       │   ├── CV.svg
│   │       │   ├── CW.svg
│   │       │   ├── CX.svg
│   │       │   ├── CY.svg
│   │       │   ├── CZ.svg
│   │       │   ├── DA.svg
│   │       │   ├── DE.svg
│   │       │   ├── DJ.svg
│   │       │   ├── DK.svg
│   │       │   ├── DM.svg
│   │       │   ├── DO.svg
│   │       │   ├── DZ.svg
│   │       │   ├── EC.svg
│   │       │   ├── EE.svg
│   │       │   ├── EG.svg
│   │       │   ├── EH.svg
│   │       │   ├── EL.svg
│   │       │   ├── EN.svg
│   │       │   ├── ER.svg
│   │       │   ├── ES.svg
│   │       │   ├── ET.svg
│   │       │   ├── EU.svg
│   │       │   ├── FI.svg
│   │       │   ├── FJ.svg
│   │       │   ├── FK.svg
│   │       │   ├── FM.svg
│   │       │   ├── FO.svg
│   │       │   ├── FR.svg
│   │       │   ├── GA.svg
│   │       │   ├── GB-ENG.svg
│   │       │   ├── GB-NIR.svg
│   │       │   ├── GB-SCT.svg
│   │       │   ├── GB-WLS.svg
│   │       │   ├── GB-ZET.svg
│   │       │   ├── GB.svg
│   │       │   ├── GD.svg
│   │       │   ├── GE.svg
│   │       │   ├── GF.svg
│   │       │   ├── GG.svg
│   │       │   ├── GH.svg
│   │       │   ├── GI.svg
│   │       │   ├── GL.svg
│   │       │   ├── GM.svg
│   │       │   ├── GN.svg
│   │       │   ├── GP.svg
│   │       │   ├── GQ.svg
│   │       │   ├── GR.svg
│   │       │   ├── GS.svg
│   │       │   ├── GT.svg
│   │       │   ├── GU.svg
│   │       │   ├── GW.svg
│   │       │   ├── GY.svg
│   │       │   ├── HK.svg
│   │       │   ├── HM.svg
│   │       │   ├── HN.svg
│   │       │   ├── HR.svg
│   │       │   ├── HT.svg
│   │       │   ├── HU.svg
│   │       │   ├── ID.svg
│   │       │   ├── IE.svg
│   │       │   ├── IL.svg
│   │       │   ├── IM.svg
│   │       │   ├── IN.svg
│   │       │   ├── IO.svg
│   │       │   ├── IQ.svg
│   │       │   ├── IR.svg
│   │       │   ├── IS.svg
│   │       │   ├── IT.svg
│   │       │   ├── JA.svg
│   │       │   ├── JE.svg
│   │       │   ├── JM.svg
│   │       │   ├── JO.svg
│   │       │   ├── JP.svg
│   │       │   ├── KE.svg
│   │       │   ├── KG.svg
│   │       │   ├── KH.svg
│   │       │   ├── KI.svg
│   │       │   ├── KM.svg
│   │       │   ├── KN.svg
│   │       │   ├── KP.svg
│   │       │   ├── KR.svg
│   │       │   ├── KW.svg
│   │       │   ├── KY.svg
│   │       │   ├── KZ.svg
│   │       │   ├── LA.svg
│   │       │   ├── LB.svg
│   │       │   ├── LC.svg
│   │       │   ├── LGBT.svg
│   │       │   ├── LI.svg
│   │       │   ├── LK.svg
│   │       │   ├── LR.svg
│   │       │   ├── LS.svg
│   │       │   ├── LT.svg
│   │       │   ├── LU.svg
│   │       │   ├── LV.svg
│   │       │   ├── LY.svg
│   │       │   ├── MA.svg
│   │       │   ├── MC.svg
│   │       │   ├── MD.svg
│   │       │   ├── ME.svg
│   │       │   ├── MF.svg
│   │       │   ├── MG.svg
│   │       │   ├── MH.svg
│   │       │   ├── MK.svg
│   │       │   ├── ML.svg
│   │       │   ├── MM.svg
│   │       │   ├── MN.svg
│   │       │   ├── MO.svg
│   │       │   ├── MP.svg
│   │       │   ├── MQ.svg
│   │       │   ├── MR.svg
│   │       │   ├── MS.svg
│   │       │   ├── MT.svg
│   │       │   ├── MU.svg
│   │       │   ├── MV.svg
│   │       │   ├── MW.svg
│   │       │   ├── MX.svg
│   │       │   ├── MY.svg
│   │       │   ├── MZ.svg
│   │       │   ├── NA.svg
│   │       │   ├── NC.svg
│   │       │   ├── NE.svg
│   │       │   ├── NF.svg
│   │       │   ├── NG.svg
│   │       │   ├── NI.svg
│   │       │   ├── NL.svg
│   │       │   ├── NO.svg
│   │       │   ├── NP.svg
│   │       │   ├── NR.svg
│   │       │   ├── NU.svg
│   │       │   ├── NZ.svg
│   │       │   ├── OM.svg
│   │       │   ├── PA.svg
│   │       │   ├── PE.svg
│   │       │   ├── PF.svg
│   │       │   ├── PG.svg
│   │       │   ├── PH.svg
│   │       │   ├── PK.svg
│   │       │   ├── PL.svg
│   │       │   ├── PM.svg
│   │       │   ├── PN.svg
│   │       │   ├── PR.svg
│   │       │   ├── PS.svg
│   │       │   ├── PT.svg
│   │       │   ├── PW.svg
│   │       │   ├── PY.svg
│   │       │   ├── QA.svg
│   │       │   ├── RE.svg
│   │       │   ├── RH.svg
│   │       │   ├── RO.svg
│   │       │   ├── RS.svg
│   │       │   ├── RU.svg
│   │       │   ├── RW.svg
│   │       │   ├── SA.svg
│   │       │   ├── SB.svg
│   │       │   ├── SC.svg
│   │       │   ├── SD.svg
│   │       │   ├── SE.svg
│   │       │   ├── SG.svg
│   │       │   ├── SH.svg
│   │       │   ├── SI.svg
│   │       │   ├── SJ.svg
│   │       │   ├── SK.svg
│   │       │   ├── SL.svg
│   │       │   ├── SM.svg
│   │       │   ├── SN.svg
│   │       │   ├── SO.svg
│   │       │   ├── SR.svg
│   │       │   ├── SS.svg
│   │       │   ├── ST.svg
│   │       │   ├── SV.svg
│   │       │   ├── SV1.svg
│   │       │   ├── SX.svg
│   │       │   ├── SY.svg
│   │       │   ├── SZ.svg
│   │       │   ├── TC.svg
│   │       │   ├── TD.svg
│   │       │   ├── TF.svg
│   │       │   ├── TG.svg
│   │       │   ├── TH.svg
│   │       │   ├── TJ.svg
│   │       │   ├── TK.svg
│   │       │   ├── TL.svg
│   │       │   ├── TM.svg
│   │       │   ├── TN.svg
│   │       │   ├── TO.svg
│   │       │   ├── TR.svg
│   │       │   ├── TT.svg
│   │       │   ├── TV.svg
│   │       │   ├── TW.svg
│   │       │   ├── TZ.svg
│   │       │   ├── UG.svg
│   │       │   ├── UK.svg
│   │       │   ├── UK1.svg
│   │       │   ├── UM.svg
│   │       │   ├── US-CA.svg
│   │       │   ├── US.svg
│   │       │   ├── UY.svg
│   │       │   ├── UZ.svg
│   │       │   ├── VA.svg
│   │       │   ├── VC.svg
│   │       │   ├── VE.svg
│   │       │   ├── VG.svg
│   │       │   ├── VI.svg
│   │       │   ├── VN.svg
│   │       │   ├── VU.svg
│   │       │   ├── WF.svg
│   │       │   ├── WS.svg
│   │       │   ├── XK.svg
│   │       │   ├── YE.svg
│   │       │   ├── YT.svg
│   │       │   ├── ZA.svg
│   │       │   ├── ZH.svg
│   │       │   ├── ZM.svg
│   │       │   └── ZW.svg
│   │       ├── auth-cover.svg
│   │       ├── card-americanexpress.svg
│   │       ├── card-mastercard.svg
│   │       ├── card-visa.svg
│   │       ├── carousel1.jpeg
│   │       ├── carousel2.jpeg
│   │       ├── carousel3.jpeg
│   │       ├── checked.svg
│   │       ├── close.svg
│   │       ├── coming-soon.svg
│   │       ├── custom-swal.svg
│   │       ├── drag-1.jpeg
│   │       ├── drag-2.jpeg
│   │       ├── drag-4.jpg
│   │       ├── features_overview.svg
│   │       ├── file-preview.svg
│   │       ├── g-8.png
│   │       ├── lightbox1.jpg
│   │       ├── lightbox2.jpeg
│   │       ├── lightbox3.jpeg
│   │       ├── lightbox4.jpeg
│   │       ├── lightbox5.jpeg
│   │       ├── lightbox6.jpeg
│   │       ├── litecoin.svg
│   │       ├── logo.svg
│   │       ├── map-dark.svg
│   │       ├── map.svg
│   │       ├── menu-heade.jpg
│   │       ├── notification-bg.png
│   │       ├── product-camera.jpg
│   │       ├── product-headphones.jpg
│   │       ├── product-laptop.jpg
│   │       ├── product-shoes.jpg
│   │       ├── product-watch.jpg
│   │       ├── profile-1.jpeg
│   │       ├── profile-10.jpeg
│   │       ├── profile-11.jpeg
│   │       ├── profile-12.jpeg
│   │       ├── profile-13.jpeg
│   │       ├── profile-14.jpeg
│   │       ├── profile-15.jpeg
│   │       ├── profile-16.jpeg
│   │       ├── profile-17.jpeg
│   │       ├── profile-18.jpeg
│   │       ├── profile-19.jpeg
│   │       ├── profile-2.jpeg
│   │       ├── profile-20.jpeg
│   │       ├── profile-21.jpeg
│   │       ├── profile-22.jpeg
│   │       ├── profile-23.jpeg
│   │       ├── profile-24.jpeg
│   │       ├── profile-25.jpeg
│   │       ├── profile-26.jpeg
│   │       ├── profile-27.jpeg
│   │       ├── profile-28.jpeg
│   │       ├── profile-29.jpeg
│   │       ├── profile-3.jpeg
│   │       ├── profile-30.jpeg
│   │       ├── profile-30.png
│   │       ├── profile-31.jpeg
│   │       ├── profile-32.jpeg
│   │       ├── profile-33.jpeg
│   │       ├── profile-34.jpeg
│   │       ├── profile-35.png
│   │       ├── profile-4.jpeg
│   │       ├── profile-5.jpeg
│   │       ├── profile-6.jpeg
│   │       ├── profile-7.jpeg
│   │       ├── profile-8.jpeg
│   │       ├── profile-9.jpeg
│   │       ├── settings-dark.svg
│   │       ├── settings-light.svg
│   │       ├── sweet-bg.jpg
│   │       └── user-profile.jpeg
│   ├── demo-prepare.html
│   ├── favicon.png
│   └── vite.svg
├── scripts/
│   ├── functions/
│   │   ├── ErrorHandler.ps1
│   │   ├── InteractiveMenu.ps1
│   │   ├── MenuConfig.ps1
│   │   ├── MenuState.ps1
│   │   └── Prerequisites.ps1
│   ├── architecture_restructure.py
│   ├── node-upgrade-manager.ps1
│   ├── node-upgrade-manager.sh
│   ├── restructure_for_multi_app.py
│   ├── start.ps1
│   └── switch-app-entry.js
├── services/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── users/
│   │   │   │   └── admin-users-api.ts
│   │   │   └── admin-datasource-api.ts
│   │   ├── codemart/
│   │   │   └── codemart-projects-api.ts
│   │   ├── dashboard/
│   │   │   └── dashboard-analytics-api.ts
│   │   ├── dev/
│   │   │   ├── dev-devops-api.ts
│   │   │   ├── dev-devops-integration-api.ts
│   │   │   └── dev-tools-api.ts
│   │   ├── example/
│   │   │   └── example-datasource-api.ts
│   │   ├── main/
│   │   │   ├── analytics/
│   │   │   │   └── main-analytics-api.ts
│   │   │   └── main-datasource-api.ts
│   │   ├── charts.ts
│   │   ├── dashboard.ts
│   │   ├── enhanced-dashboard.ts
│   │   ├── finance.ts
│   │   ├── nuxt-fetch.ts
│   │   └── tables.ts
│   ├── config/
│   │   ├── api-config-manager.ts
│   │   └── endpoints.ts
│   └── datasource/
│       └── manager.ts
├── stores/
│   ├── apps/
│   │   ├── admin-store.ts
│   │   └── codemart-store.ts
│   ├── base/
│   │   └── base-store.ts
│   ├── app-datasource.ts
│   ├── datasource.ts
│   └── index.ts
├── theme/
│   ├── apps/
│   │   ├── admin-theme.ts
│   │   ├── codemart-theme.ts
│   │   ├── dashboard-theme.ts
│   │   ├── dev-theme.ts
│   │   └── example-theme.ts
│   └── base-theme.config.ts
├── types/
│   ├── api.ts
│   ├── datasource.ts
│   └── devops.ts
├── utils/
│   ├── apiHelpers.ts
│   └── namespace-registry.ts
├── .gitignore
├── README.md
├── app-entry.ts
├── app-setting.ts
├── env.example
├── nuxt.config.ts
├── nuxt_main_tree.md
├── package.json
├── startByDev.sh
├── startByServer.ps1
├── startByServer.sh
├── startByWinDev.ps1
├── task.txt
├── theme.config.ts
├── tsconfig.bak.json
└── tsconfig.json
```

---
*Generated by Directory Tree Generator*