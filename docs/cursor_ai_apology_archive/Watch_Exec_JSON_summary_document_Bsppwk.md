# Watch/Exec JSON config - summary document [Bsppwk]

to use HuTiGong `<content>` ( WenJianJianShi and Zhi line use JSON config ) JianMing summary . 

## structure 
- DanCeng JSON to Xiang . 
- char segment : watch, ignore, ext, verbose, exec, restartable, colours, events. 

## key points 
- watch: ["ncore/", "apps/", "main.js"]. 
- ignore: []. 
- ext: "js,json". 
- verbose: true. 
- exec: node ./main.js --app=VoiceStaticServer --word_segmentation=0-30000. 
- restartable: "hr". 
- colours: true. 
- events: {}. 

## purpose 
- as nodemon or LeiSiGongJu config , JianTing ncore/, apps/, main.js js/json BianGeng and ZiDongChongQi , Yun line VoiceStaticServer ( FenCi 030000) . 
