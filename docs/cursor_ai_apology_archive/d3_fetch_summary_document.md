# d3-fetch - summary document 

to use HuTiGong `<content>` (d3-fetch YaSuoBaoYuanMa ) JianMing summary . 

## structure 
- UMD YaSuoBao (v3.0.1) , YiLai d3-dsv; RuKou for IIFE, GenJu exports/define/global GuaZai to `t.d3`. 
- within Bu : to fetch XiangYing JianChaHanShu (e/r/o to Ying blob/arrayBuffer/text) ; u for fetch+text; f for "fetch HouJieXi " GongChang (csv/tsv use ) ; a for json ( Fei 204/205 when ) ; c for DOMParser GongChang (xml/html/svg) ; ZuiHouJiang blob, buffer, text, csv, tsv, dsv, json, html, xml, svg, image Gua to DaoChu to Xiang . 

## key points 
- Suo have Ji at fetch method in `!t.ok` when PaoChu `Error(status + statusText)`. 
- csv/tsv TongGuo d3-dsv parse JieXiWen this ; dsv ZhiChiZiDingYiFenGeFu and parse Xuan item . 
- json in 204/205 when not Du body; html, xml, svg use DOMParser parseFromString; image use new Image() JiaZai and FanHui Promise. 
- ZhiChiKeXuan init CanShu ( No. Er CanShu ) ChuanRu fetch Xuan item . 

## purpose 
in LiuLanQi in TongYiFengZhuang fetch, and ZhiJie to JieXiHou ShuJu (CSV/TSV/JSON/HTML/XML/SVG) or Blob/ArrayBuffer/Image, Gong D3 etc. ShuJuKeShiHua or QianDuanJiao this use . 
