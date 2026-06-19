# Notification/Experience Arbitration Config JSON summary document 

this WenDang to use HuTiGong `<content>` ( TongZhi / TiYanZhongCai and YiZhi config JSON) ZuoJianMing summary . 

## structure GaiLan 
- ** DingCengJian **: ArbitrationSignal, CustomSuppressionPolicies, DynamicSuppressionBypass, ExperienceCohorts, FunctionalCohort, GlobalSuppressedExperiences, IgnoredFunctionalNotifications, ModelInfo, ModelSuppressionBypass, NotificationsAllowLists, PrivilegedExperiences, ReserveApproved, ScenarioSuppressLists, SuppressedExperiences, TimeDelta, baseConfigVersion, configVersion. 

## key points 
- **CustomSuppressionPolicies**: AnTiYan ID ( such as xxx.AutoOpen) config `notification_max_quick_dismiss_count` ( KuaiSuGuanBiCiShuShangXian ) . 
- **DynamicSuppressionBypass**: ExperienceIDs, TeamIDs LieBiao , this XieTiYanKeRaoGuoDongTaiYiZhi . 
- **ExperienceCohorts.DefaultCohort**: DaLiangTiYan ID YingShe for 1 or 2, BiaoShiDuiLie / QuanZhong or is FouQi use . 
- **FunctionalCohort**: GongNengLeiTiYan ID ShuZu . 
- **GlobalSuppressedExperiences**: QuanJu by YiZhi TiYan ID. 
- **ModelInfo**: segment_id, signals ( such as notification_click_rate, notification_dismiss_rate etc. ) , threshold_value, use at MoXingZhongCai . 
- **PrivilegedExperiences**: Xiang have TeQuan TiYan ID LieBiao , Duo and GouWu , YouHuiQuan , FanLi , ZiDongTianChong etc. XiangGuan . 

## purpose 
as KeHuDuanTongZhi and TiYanZhanShi YuanCheng config , KongZhiNaXieTiYanKeZhanShi , NaXie by YiZhi , KuaiSuGuanBiShangXian and MoXing / ZhongCaiXiangGuanCanShu , Shi use at LiuLanQi or KeHuDuan within Nurturing, Shopping, Bing, Rewards etc. ChangJing . 
