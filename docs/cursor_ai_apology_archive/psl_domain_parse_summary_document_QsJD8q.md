# psl YuMingJieXiLeiXingShengMing - summary document [QsJD8q]

to use HuTiGong `<content>` (TypeScript YuMingJieXiKuShengMing ) JianMing summary . 

## structure 
- ZhuShi TypeScript Version: 2.4. 
- ErrorResult<T extends keyof errorCodes>: input: string; error: { code: T; message: errorCodes[T] }. 
- errorCodes ChangLiangMeiJu : DOMAIN_TOO_SHORT, DOMAIN_TOO_LONG, LABEL_STARTS_WITH_DASH, LABEL_ENDS_WITH_DASH, LABEL_TOO_LONG, LABEL_TOO_SHORT, LABEL_INVALID_CHARS, Zhi for YingWenMiaoShu char FuChuan . 
- export as namespace psl. 
- ParsedDomain: input, tld, sld, domain, subdomain ( Jun for string | null) , listed: boolean. 
- HanShuShengMing : parse(input: string): ParsedDomain | ErrorResult<keyof errorCodes>; get(domain: string): string | null; isValid(domain: string): boolean. 

## key points 
- JieXiShiBaiFanHui ErrorResult, ChengGongFanHui ParsedDomain; get QuJiChuYuMing , isValid PanDuan is Fou in YiZhiGongGongHouZhuiLieBiao in . 

## purpose 
for psl (Public Suffix List) LeiYuMingJieXiKuTiGongLeiXingDingYi , Gong parse, get, isValid and CuoWuMa in TypeScript in LeiXingAnQuan use . 
