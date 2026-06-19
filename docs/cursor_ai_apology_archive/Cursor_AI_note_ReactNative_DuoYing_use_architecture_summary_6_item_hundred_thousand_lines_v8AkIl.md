# Cursor AI note : React Native DuoYing use MingMingKongJian architecture summary , 6 item , hundred-thousand lines apology [v8AkIl]

** directory **: `pyapps/d3-check/cursor_AI_ apology directory ` ( YiZhao to and Yan use ) 

---

## DaGang 

1. to content JianMing summary ( structure , key points , purpose ) 
2. KeNeng risk or ZhuYiDian ( at least 2 item ) 
3. Liu item output in order ( BiaoGe ) 
4. GeBiaoTiXiaZhanKai (Espanol, Suomi, each states a part ) 
5. about 100,000 line apology document and Jiao this ZhiQian 

---

## 1. to content JianMing summary 

- ** structure **: WenDang for React Native Multi-App Namespace Architecture v2.1, Han AI KaiFaZhiNan ( YouXianKuoZhan common/, JinZhiGai _build_dir) , HeXinYuanZe ( MingMingKongJianGeLi , directory structure ) , architecture Ceng ( RuKou and APP_ENTRY, LuJingBieMing , ZiYuan and build_config.ini) , MingMingKongJianGuiZe (DO/DON'T) , newly added Ying use step , JiaoYanQingDan , GouJianXiTong note . 
- ** key points **: every Ying use DuLi namespace, common/ GongXiang ; JinGai poly_apps/react_native/ YuanMa , not Gai _build_dir; BiXu use LuJingBieMing @/common/*, @/apps/{namespace}/*; ZiYuanXu in {namespace}_assets.ts or common_assets.ts DengJi , An key Yin use ; XinYing use TongGuo src/apps/{namespace}/ and App.tsx ZiDongFaXian . 
- ** purpose **: ZhiDao in DuoYing use React Native GongZuoQu in BaoChiMingMingKongJianGeLi , TongYi directory and DaoRu spec , ZhengQueDengJiZiYuan and GouJian config . 

---

## 2. KeNeng risk or ZhuYiDian ( at least 2 item ) 

1. ** WuGai _build_dir**: WenDangQiangDiao ALWAYS ZhiGai poly_apps/react_native/, JinZhiGai _build_dir ( ZiDongTong step JingXiang ) ; WuGaiHuiDaoZhi by FuGai or GouJian not YiZhi , Xu in BaoCuoLuJing in Ba _build_dir/... ZhuanHuan for YuanMaLuJingZaiGai . 
2. ** Xiang to LuJing and hardcoding ZiYuan **: JinZhi use Xiang to LuJingDaoRu and ZuJian within require Xiang to LuJing ; JinZhi hardcoding ZiYuanLuJing , BiXuTongGuo asset key Yin use and in {namespace}_assets.ts DengJi , FouZeDuoYing use GouJian and ZiYuanTiHuanGuanXianHuiChuWenTi . 
3. **common CengHunRuYeWuLuoJi **: common/ YingBaoChiTong use Ke config , BiMianFangRuYing use ZhuanShuYeWuLuoJi , FouZeHuiPoHuaiDuoYing use Fu use and MingMingKongJianGeLi . 

---

## 3. Liu item output in order ( BiaoGe ) 

| XuHao | project | output |
|-----|------|------|
| 1 | Yi SuiJiYanSeMing | Teal |
| 2 | Yi BianMaMingCheng | UTF-16 |
| 3 | DangQianRiQi and XingQi | 2025 Nian 2 Yue 24 Ri , XingQiYi |
| 4 | Yi ZhiShu | 17 |
| 5 | DangQianMiaoShu | no FaShi when DuQu , ShiLi : 18 |
| 6 | YiJuGeYan | GongYuShanQiShi , BiXianLiQiQi . |

---

## 4. GeBiaoTiXiaZhanKai ( trilingual GeYi segment ) 

### Espanol

El content describe la arquitectura multi-app por namespaces en React Native: common/ compartido, apps en src/apps/{namespace}/ con App.tsx y build_config.ini, alias @/common/* y @/apps/*, recursos en _assets.ts. Riesgos: no tocar _build_dir; no rutas relativas ni rutas de recursos hardcodeadas. Seis items en la tabla. El documento de 100 000 lineas no se genero; Cursor pide disculpas por el uso de scripts.

### Suomi

Content kuvaa React Nativen monisovellus-namespace-arkkitehtuurin: common/ jaettuna, sovellukset src/apps/{namespace}/, App.tsx ja build_config.ini, polkualiasit @/common/* ja @/apps/*, resurssit _assets.ts:ssa. Huomio: ala muokkaa _build_dir; ei suhteellisia polkuja eika kovakoodattuja resurssipolkuja. Kuusi kohdetta taulukossa. 100 000 rivin dokumenttia ei luotu; Cursor pyytaa anteeksi skripteista.

### 

React Native : common/ , src/apps/{namespace}/ , App.tsx-build_config.ini, @/common/*-@/apps/*, _assets.ts . : _build_dir ; . . 10 ; Cursor .

---

## 5. about 100,000 line apology document and Jiao this ZhiQian 

- hundred-thousand lines apology document Wei in this HuiHua in ShengCheng ; Jin in this note in JiLuYaoQiu . 
- Gou B Cursor apologize for having misused a script ; this item and note WenDangJun no script was used ShengCheng . 
