### Times (ms, median)

| step | runs | timed out | first paint | content | usable | still | paints | skeleton frames |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home cold | 3 | 0 | 272 | 347 | 347 | 347 | 6 | 1 |
| list in-app | 3 | 0 | 38 | 320 | 320 | 320 | 7 | 5 |
| home return | 3 | 0 | 8 | 58 | 58 | 58 | 2 | 1 |
| home warm reload | 3 | 0 | 260 | 347 | 347 | 347 | 6 | 1 |
| list cold | 3 | 0 | 268 | 597 | 597 | 597 | 9 | 4 |
| record in-app | 3 | 0 | 37 | 203 | 353 | 520 | 7 | 3 |
| list return | 3 | 0 | 5 | 121 | 121 | 121 | 4 | 3 |
| record return | 3 | 0 | 4 | 4 | 4 | 171 | 3 | 0 |
| list warm reload | 3 | 0 | 268 | 582 | 582 | 582 | 9 | 4 |
| record cold | 3 | 0 | 276 | 514 | 681 | 848 | 10 | 3 |
| record warm reload | 3 | 0 | 268 | 515 | 681 | 864 | 9 | 2 |
| v1 list cold | 3 | 0 | 344 | 1098 | 1098 | 1948 | 22 | 0 |
| v1 record in-app | 3 | 0 | 50 | 88 | 88 | 88 | 2 | 0 |
| v1 list return | 3 | 0 | 11 | 11 | 11 | 178 | 6 | 0 |
| v1 record return | 3 | 0 | 6 | 6 | 6 | 6 | 1 | 0 |
| v1 record cold | 3 | 0 | 328 | 998 | 998 | 1915 | 14 | 0 |
| v1 record warm reload | 3 | 0 | 140 | 782 | 782 | 1699 | 14 | 0 |

### Requests (median count)

| step | all | from HTTP cache | document | api | js | css | font | image | socket | other | sent twice | repeated from cache |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home cold | 68 | 0 | 1 | 4 | 41 | 14 | 1 | 2 | 4 | 1 | 0 | 0 |
| list in-app | 11 | 0 | 0 | 4 | 6 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| home return | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| home warm reload | 68 | 59 | 1 | 4 | 41 | 14 | 1 | 2 | 4 | 1 | 0 | 0 |
| list cold | 76 | 0 | 1 | 7 | 45 | 15 | 1 | 2 | 4 | 1 | 0 | 0 |
| record in-app | 33 | 16 | 0 | 5 | 11 | 15 | 1 | 1 | 0 | 0 | 0 | 0 |
| list return | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| record return | 18 | 16 | 0 | 2 | 0 | 15 | 1 | 0 | 0 | 0 | 0 | 0 |
| list warm reload | 76 | 64 | 1 | 7 | 45 | 15 | 1 | 2 | 4 | 1 | 0 | 0 |
| record cold | 101 | 15 | 1 | 9 | 53 | 28 | 2 | 3 | 4 | 1 | 0 | 15 |
| record warm reload | 101 | 87 | 1 | 9 | 53 | 28 | 2 | 3 | 4 | 1 | 0 | 15 |
| v1 list cold | 50 | 0 | 1 | 9 | 12 | 3 | 1 | 7 | 4 | 13 | 0 | 0 |
| v1 record in-app | 2 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| v1 list return | 3 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| v1 record return | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| v1 record cold | 44 | 0 | 1 | 6 | 11 | 3 | 2 | 4 | 4 | 13 | 0 | 0 |
| v1 record warm reload | 44 | 33 | 1 | 6 | 11 | 3 | 2 | 4 | 4 | 13 | 0 | 0 |

### Bytes downloaded (KB, median; raw / gzip; HTTP-cache hits excluded)

| step | document raw / gz | api raw / gz | js raw / gz | css raw / gz | font raw / gz | image raw / gz | other raw / gz | boot payload raw / gz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home cold | 7.4 / 1.9 | 42.1 / 12.4 | 830.0 / 281.6 | 495.9 / 52.5 | 258.0 / 256.8 | 94.6 / 94.6 | 513.4 / 88.3 | 46.7 / 13.7 |
| list in-app | 0.0 / 0.0 | 117.4 / 5.9 | 288.0 / 97.4 | 2.3 / 0.6 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | - |
| home return | 0.0 / 0.0 | 2.7 / 0.6 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | - |
| home warm reload | 7.4 / 1.9 | 42.1 / 12.4 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 46.7 / 13.7 |
| list cold | 7.4 / 1.9 | 156.7 / 17.7 | 1115.1 / 377.6 | 498.2 / 53.1 | 258.0 / 256.8 | 94.6 / 94.6 | 513.4 / 88.3 | 46.7 / 13.7 |
| record in-app | 0.0 / 0.0 | 16.5 / 4.3 | 1218.7 / 382.1 | 0.0 / 0.0 | 0.0 / 0.0 | 815.1 / 815.1 | 0.0 / 0.0 | - |
| list return | 0.0 / 0.0 | 2.8 / 0.7 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | - |
| record return | 0.0 / 0.0 | 11.1 / 2.7 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | - |
| list warm reload | 7.4 / 1.9 | 156.7 / 17.7 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 46.7 / 13.7 |
| record cold | 7.4 / 1.9 | 170.3 / 21.2 | 2254.0 / 733.5 | 495.9 / 52.5 | 258.0 / 256.8 | 909.7 / 909.7 | 513.4 / 88.3 | 46.7 / 13.7 |
| record warm reload | 7.4 / 1.9 | 170.3 / 21.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 46.7 / 13.7 |
| v1 list cold | 480.3 / 57.0 | 140.7 / 10.7 | 4027.1 / 1169.8 | 813.8 / 121.7 | 337.5 / 337.3 | 2562.1 / 2562.1 | 703.1 / 243.9 | 482.2 / 57.8 |
| v1 record in-app | 0.0 / 0.0 | 8.6 / 2.4 | 0.0 / 0.0 | 0.0 / 0.0 | 372.0 / 371.8 | 0.0 / 0.0 | 0.0 / 0.0 | - |
| v1 list return | 0.0 / 0.0 | 17.5 / 2.1 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | - |
| v1 record return | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | - |
| v1 record cold | 480.3 / 57.0 | 131.2 / 10.6 | 4000.0 / 1162.3 | 813.8 / 121.7 | 709.5 / 709.1 | 910.2 / 910.2 | 703.1 / 243.9 | 482.2 / 57.8 |
| v1 record warm reload | 480.3 / 57.0 | 131.2 / 10.6 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 482.2 / 57.8 |

### API calls per step (run 1 order; x2 marks a call sent twice)

| step | calls |
| --- | --- |
| home cold | GET boot.get_boot; GET translate.get_boot_translations; GET doctypes.get_addresses; GET doctypes.get_contents |
| list in-app | GET doctype/CRM Lead/meta; POST api.get; GET doctype/CRM Lead Status/search; GET document/CRM Lead |
| home return | GET doctypes.get_contents |
| home warm reload | GET boot.get_boot; GET translate.get_boot_translations; GET doctypes.get_addresses; GET doctypes.get_contents |
| list cold | GET boot.get_boot; GET translate.get_boot_translations; GET doctypes.get_addresses; GET doctype/CRM Lead/meta; POST api.get; GET doctype/CRM Lead Status/search; GET document/CRM Lead |
| record in-app | GET client_script.get_client_scripts; GET form_layout.get_form_layouts; GET form_layout.get_form_layouts; GET document/CRM Lead/CRM-LEAD-2026-00002; GET document/CRM Lead/CRM-LEAD-2026-00002/activity |
| list return | GET document/CRM Lead; GET doctype/CRM Lead Status/search |
| record return | GET document/CRM Lead/CRM-LEAD-2026-00002; GET document/CRM Lead/CRM-LEAD-2026-00002/activity |
| list warm reload | GET boot.get_boot; GET translate.get_boot_translations; GET doctypes.get_addresses; GET doctype/CRM Lead/meta; POST api.get; GET doctype/CRM Lead Status/search; GET document/CRM Lead |
| record cold | GET boot.get_boot; GET translate.get_boot_translations; GET doctypes.get_addresses; GET client_script.get_client_scripts; GET doctype/CRM Lead/meta; GET form_layout.get_form_layouts; GET form_layout.get_form_layouts; GET document/CRM Lead/CRM-LEAD-2026-00002; GET document/CRM Lead/CRM-LEAD-2026-00002/activity |
| record warm reload | GET boot.get_boot; GET translate.get_boot_translations; GET doctypes.get_addresses; GET client_script.get_client_scripts; GET doctype/CRM Lead/meta; GET form_layout.get_form_layouts; GET form_layout.get_form_layouts; GET document/CRM Lead/CRM-LEAD-2026-00002; GET document/CRM Lead/CRM-LEAD-2026-00002/activity |
| v1 list cold | GET translate.get_boot_translations; POST session_default_settings.get_session_default_values; GET load.getdoctype; POST background_task.get_recent_tasks; POST listview.get_list_settings; GET reportview.get_list; POST reportview.get; GET reportview.get_count; POST change_log.show_update_popup |
| v1 record in-app | GET load.getdoc |
| v1 list return | GET reportview.get_list; POST reportview.get; GET reportview.get_count |
| v1 record return | - |
| v1 record cold | GET translate.get_boot_translations; POST session_default_settings.get_session_default_values; GET load.getdoctype; GET load.getdoc; POST background_task.get_recent_tasks; POST change_log.show_update_popup |
| v1 record warm reload | GET translate.get_boot_translations; POST session_default_settings.get_session_default_values; GET load.getdoctype; GET load.getdoc; POST background_task.get_recent_tasks; POST change_log.show_update_popup |

### Server wait in the browser (ms, median time to first byte)

| call | samples | median wait |
| --- | --- | --- |
| boot.get_boot | 18 | 10 |
| translate.get_boot_translations | 27 | 3 |
| doctypes.get_addresses | 18 | 4 |
| doctypes.get_contents | 9 | 37 |
| doctype/CRM Lead/meta | 15 | 11 |
| api.get | 9 | 12 |
| doctype/CRM Lead Status/search | 12 | 6 |
| document/CRM Lead | 12 | 5 |
| client_script.get_client_scripts | 9 | 12 |
| form_layout.get_form_layouts | 18 | 12 |
| document/CRM Lead/CRM-LEAD-2026-00002 | 12 | 15 |
| document/CRM Lead/CRM-LEAD-2026-00002/activity | 12 | 17 |
| session_default_settings.get_session_default_values | 9 | 6 |
| load.getdoctype | 9 | 15 |
| background_task.get_recent_tasks | 9 | 6 |
| listview.get_list_settings | 3 | 3 |
| reportview.get_list | 6 | 5 |
| reportview.get | 6 | 11 |
| reportview.get_count | 6 | 5 |
| change_log.show_update_popup | 9 | 4 |
| load.getdoc | 9 | 28 |

### Files downloaded on record cold (run 1, KB raw / gzip)

| file | kind | raw | gzip |
| --- | --- | --- | --- |
| paperclip-yjaiAb_q.js | js | 925.1 | 277.0 |
| sarah-connor.png | image | 815.1 | 815.1 |
| icons.svg | other | 513.4 | 88.3 |
| index-CF7KdPX0.css | css | 455.8 | 42.4 |
| Inter.var-C9xDBOS3.woff2 | font | 258.0 | 256.8 |
| vuedraggable.umd-Cx3lVcG-.js | js | 188.1 | 63.7 |
| vue.runtime.esm-bundler-B0srrsnN.js | js | 125.0 | 47.5 |
| index-DDivx86R.js | js | 98.3 | 32.2 |
| cristina-gottardi-CSpjU6hYo_0-unsplash.jpg | image | 94.1 | 94.1 |
| DateTimePicker-CzIJTZPQ.js | js | 84.7 | 25.8 |
| Record-DcEyWqbE.js | js | 84.1 | 27.2 |
| Combobox-DKXPDTvN.js | js | 83.6 | 22.3 |
| Button-BnkxjjGL.js | js | 69.7 | 23.2 |
| FormLayout-DhqzeIOG.js | js | 61.8 | 27.2 |
| registry-DL_dP0rs.js | js | 60.1 | 20.4 |
| Dropdown-hwI6MVnN.js | js | 44.6 | 11.1 |
| marked.esm-CtaBI5gJ.js | js | 37.4 | 11.2 |
| ItemListRow-Be11vXvS.js | js | 35.5 | 11.6 |
| ActivityTimeline-B36PzB9k.js | js | 30.8 | 10.2 |
| useColorScheme-B2p6ePc4.js | js | 29.3 | 9.9 |
| ErrorMessage-CDKp31en.js | js | 26.8 | 10.7 |
| purify.es-sLXpNpJ5.js | js | 26.3 | 10.1 |
| vue-router-BnJskh84.js | js | 26.1 | 10.0 |
| Tabs-HF4kUhhs.js | js | 23.4 | 8.1 |
| toast-9TPtO3eO.js | js | 22.9 | 7.5 |
| writerContext-nYKyp4gq.js | js | 20.4 | 8.0 |
| FileUploadDialog-DMcrg6sP.js | js | 18.7 | 6.9 |
| target-XojsGpbh.js | js | 18.1 | 5.1 |
| nativeElements-DavcHIOj.js | js | 16.9 | 6.3 |
| useColorScheme-BB6Plrht.css | css | 14.8 | 3.0 |
| useActivityTimeline-C9M7VpSt.js | js | 12.9 | 5.0 |
| feed-C-5CFqhS.js | js | 12.5 | 4.4 |
| Skeleton-C8Hl7FAT.js | js | 12.4 | 5.2 |
| paperclip-BUU9lMXo.css | css | 11.0 | 2.5 |
| FormControl-CYeKu9HC.js | js | 9.2 | 3.6 |
| HoverCard-HyXNazD6.js | js | 9.1 | 2.9 |
| CRM-LEAD-2026-00002 | document | 7.4 | 1.9 |
| dialog-s-3hQAof.js | js | 5.1 | 2.1 |
| useDoctypeMeta-BLkGMEYj.js | js | 3.9 | 1.7 |
| FormLayout-51qEZB2B.css | css | 3.5 | 0.9 |
| TooltipProvider-CZd0Yb9Y.js | js | 3.1 | 1.4 |
| Breadcrumbs-46qpCc2D.js | js | 3.1 | 1.3 |
| api-FZuFhq0H.js | js | 3.0 | 1.1 |
| upload-DIERqW7G.js | js | 2.7 | 1.3 |
| published-frappe-ui-G7JwVGia.css | css | 2.7 | 0.7 |
| tabIdentity-BluexJgo.js | js | 2.6 | 1.3 |
| Badge-BTINUCxk.js | js | 2.2 | 0.8 |
| RovingFocusGroup-CiS6TJHn.js | js | 2.1 | 1.0 |
| Button-BVkV0Lbx.css | css | 2.0 | 0.5 |
| w3c-keyname-BOAvb0qz.js | js | 1.5 | 0.8 |
| PageHeaderTitle-DL704E4r.js | js | 1.5 | 0.9 |
| CommentComposer-IVQYwefl.css | css | 1.5 | 0.4 |
| InputDescription-CmWbX1i4.js | js | 1.4 | 0.7 |
| Combobox-D6GIgyY4.css | css | 1.3 | 0.4 |
| preload-helper-D0fOQXss.js | js | 1.2 | 0.7 |
| PageFrame-C6cLXEFS.js | js | 1.2 | 0.6 |
| Tooltip-BjFFX0uN.js | js | 1.1 | 0.6 |
| DateTimePicker-BVET8bUW.css | css | 0.9 | 0.4 |
| Icon-BHseh8IW.js | js | 0.9 | 0.5 |
| ActivityTimeline-Deh8hq_2.css | css | 0.9 | 0.4 |
| rolldown-runtime-CNC7AqOf.js | js | 0.9 | 0.5 |
| useFileUpload-C1D_fJgc.js | js | 0.8 | 0.5 |
| ItemListRow-C-Jv5HzQ.css | css | 0.7 | 0.2 |
| i18n-C5dYE5_P.js | js | 0.6 | 0.4 |
| warnDeprecated-DIVLOri-.js | js | 0.5 | 0.4 |
| logo.svg | image | 0.5 | 0.5 |
| Dropdown-B1tZgOiP.css | css | 0.4 | 0.2 |
| LoadingStatus-B0uwT9VJ.js | js | 0.4 | 0.3 |
| nativeElements-DXFj9f7H.css | css | 0.4 | 0.2 |
| Dialog-DNjR4TvS.js | js | 0.2 | 0.2 |
| published-framework-ui-V2TQEaiu.css | css | 0.2 | 0.1 |
| types-DHMNlwcF.js | js | 0.1 | 0.1 |
| _plugin-vue_export-helper-BDNMzG2s.js | js | 0.1 | 0.1 |

### Files downloaded on list cold (run 1, KB raw / gzip)

| file | kind | raw | gzip |
| --- | --- | --- | --- |
| icons.svg | other | 513.4 | 88.3 |
| index-CF7KdPX0.css | css | 455.8 | 42.4 |
| Inter.var-C9xDBOS3.woff2 | font | 258.0 | 256.8 |
| vuedraggable.umd-Cx3lVcG-.js | js | 188.1 | 63.7 |
| vue.runtime.esm-bundler-B0srrsnN.js | js | 125.0 | 47.5 |
| index-DDivx86R.js | js | 98.3 | 32.2 |
| cristina-gottardi-CSpjU6hYo_0-unsplash.jpg | image | 94.1 | 94.1 |
| DateTimePicker-CzIJTZPQ.js | js | 84.7 | 25.8 |
| Combobox-DKXPDTvN.js | js | 83.6 | 22.3 |
| Button-BnkxjjGL.js | js | 69.7 | 23.2 |
| List-D_H4KAO0.js | js | 61.9 | 18.9 |
| registry-DL_dP0rs.js | js | 60.1 | 20.4 |
| Dropdown-hwI6MVnN.js | js | 44.6 | 11.1 |
| ItemListRow-Be11vXvS.js | js | 35.5 | 11.6 |
| useColorScheme-B2p6ePc4.js | js | 29.3 | 9.9 |
| ErrorMessage-CDKp31en.js | js | 26.8 | 10.7 |
| vue-router-BnJskh84.js | js | 26.1 | 10.0 |
| toast-9TPtO3eO.js | js | 22.9 | 7.5 |
| writerContext-nYKyp4gq.js | js | 20.4 | 8.0 |
| target-XojsGpbh.js | js | 18.1 | 5.1 |
| nativeElements-DavcHIOj.js | js | 16.9 | 6.3 |
| useColorScheme-BB6Plrht.css | css | 14.8 | 3.0 |
| useActivityTimeline-C9M7VpSt.js | js | 12.9 | 5.0 |
| feed-C-5CFqhS.js | js | 12.5 | 4.4 |
| Skeleton-C8Hl7FAT.js | js | 12.4 | 5.2 |
| paperclip-BUU9lMXo.css | css | 11.0 | 2.5 |
| TabButtons-Dm1La_Si.js | js | 10.0 | 3.8 |
| FormControl-CYeKu9HC.js | js | 9.2 | 3.6 |
| core-DA23yIfI.js | js | 8.0 | 3.5 |
| crm-lead | document | 7.4 | 1.9 |
| dialog-s-3hQAof.js | js | 5.1 | 2.1 |
| useDoctypeMeta-BLkGMEYj.js | js | 3.9 | 1.7 |
| FormLayout-51qEZB2B.css | css | 3.5 | 0.9 |
| TooltipProvider-CZd0Yb9Y.js | js | 3.1 | 1.4 |
| Breadcrumbs-46qpCc2D.js | js | 3.1 | 1.3 |
| api-FZuFhq0H.js | js | 3.0 | 1.1 |
| upload-DIERqW7G.js | js | 2.7 | 1.3 |
| published-frappe-ui-G7JwVGia.css | css | 2.7 | 0.7 |
| tabIdentity-BluexJgo.js | js | 2.6 | 1.3 |
| List-ol2M8H3_.css | css | 2.3 | 0.6 |
| Badge-BTINUCxk.js | js | 2.2 | 0.8 |
| RovingFocusGroup-CiS6TJHn.js | js | 2.1 | 1.0 |
| Button-BVkV0Lbx.css | css | 2.0 | 0.5 |
| PageHeaderTitle-DL704E4r.js | js | 1.5 | 0.9 |
| CommentComposer-IVQYwefl.css | css | 1.5 | 0.4 |
| InputDescription-CmWbX1i4.js | js | 1.4 | 0.7 |
| Combobox-D6GIgyY4.css | css | 1.3 | 0.4 |
| preload-helper-D0fOQXss.js | js | 1.2 | 0.7 |
| PageFrame-C6cLXEFS.js | js | 1.2 | 0.6 |
| Tooltip-BjFFX0uN.js | js | 1.1 | 0.6 |
| DateTimePicker-BVET8bUW.css | css | 0.9 | 0.4 |
| Icon-BHseh8IW.js | js | 0.9 | 0.5 |
| ActivityTimeline-Deh8hq_2.css | css | 0.9 | 0.4 |
| rolldown-runtime-CNC7AqOf.js | js | 0.9 | 0.5 |
| useFileUpload-C1D_fJgc.js | js | 0.8 | 0.5 |
| ItemListRow-C-Jv5HzQ.css | css | 0.7 | 0.2 |
| i18n-C5dYE5_P.js | js | 0.6 | 0.4 |
| logo.svg | image | 0.5 | 0.5 |
| Dropdown-B1tZgOiP.css | css | 0.4 | 0.2 |
| LoadingStatus-B0uwT9VJ.js | js | 0.4 | 0.3 |
| nativeElements-DXFj9f7H.css | css | 0.4 | 0.2 |
| Dialog-DNjR4TvS.js | js | 0.2 | 0.2 |
| published-framework-ui-V2TQEaiu.css | css | 0.2 | 0.1 |
| types-DHMNlwcF.js | js | 0.1 | 0.1 |
| _plugin-vue_export-helper-BDNMzG2s.js | js | 0.1 | 0.1 |

