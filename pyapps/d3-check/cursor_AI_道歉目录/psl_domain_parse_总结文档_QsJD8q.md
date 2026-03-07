# psl 域名解析类型声明 — 总结文档 [QsJD8q]

对用户提供的 `<content>`（TypeScript 域名解析库声明）的简明总结。

## 结构
- 注释 TypeScript Version: 2.4。
- ErrorResult<T extends keyof errorCodes>：input: string；error: { code: T; message: errorCodes[T] }。
- errorCodes 常量枚举：DOMAIN_TOO_SHORT、DOMAIN_TOO_LONG、LABEL_STARTS_WITH_DASH、LABEL_ENDS_WITH_DASH、LABEL_TOO_LONG、LABEL_TOO_SHORT、LABEL_INVALID_CHARS，值为英文描述字符串。
- export as namespace psl。
- ParsedDomain：input, tld, sld, domain, subdomain（均为 string | null），listed: boolean。
- 函数声明：parse(input: string): ParsedDomain | ErrorResult<keyof errorCodes>；get(domain: string): string | null；isValid(domain: string): boolean。

## 要点
- 解析失败返回 ErrorResult，成功返回 ParsedDomain；get 取基础域名，isValid 判断是否在已知公共后缀列表中。

## 用途
为 psl（Public Suffix List）类域名解析库提供类型定义，供 parse、get、isValid 及错误码在 TypeScript 中类型安全使用。
