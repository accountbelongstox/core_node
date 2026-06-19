# technical note : coordinate_picker_data_consistency_fix.md, FLOW_IMPLEMENTATION_PROGRESS.md, tk_variables.py

this note Zhen to to XiaSanChu : XiuGaiQianQingXianTongDu this note and to YingYuanMa / WenDang . 

- `.prompts/coordinate_picker_data_consistency_fix.md`
- `docs/FLOW_IMPLEMENTATION_PROGRESS.md`
- `ui/utils/tk_variables.py`

---

## Yi , .prompts/coordinate_picker_data_consistency_fix.md

- ** purpose **: JiLuZuoBiaoShiQuQiShuJuYiZhiXingXiuFu ( YanSeGeShi , ShuJuTong step ) . Tkinter Canvas not ZhiChiDai alpha ShiLiuJinZhiYanSe ( such as #00FF0060) , ZhiZhiChi #RRGGBB; XiuFu for fill='' JinBianKuang . ShuJuLiu : Yuan for " DianJi self.picks this GuanBiChuangKouCai on_picks_updated Zhu UI", XiuFu for " every CiShiQuLi i.e. on_picks_updated([pick]) + _update_history_display()", GuanBi when not ZaiChongFuTong step . 
- ** GuanJianYueDing **: DanYiShuJuYuanXianShi use `pick_history_ref` ( Zhu UI Yin use ) , `history = self.pick_history_ref if self.pick_history_ref is not None else self.picks`; every CiShiQuLi i.e. Diao use on_picks_updated([pick]); _redraw_all_marks() use Zhu UI LiShi ; _on_close() not ZaiDiao use on_picks_updated(self.picks). 
- ** YiCuoDian **: Gai coordinate_picker_window when if HuiFu " JinGuanBi when Tong step " HuiLieBiao and BiaoJiYanChi ; if Zai use Dai alpha YanSeHui TclError; if _on_close ZaiCiDiao use on_picks_updated HuiChongFuTianJia ; if _update_history_display() or _redraw_all_marks() and pick_history_ref not TongYuanHuiXianShi not YiZhi . 
- ** ZhengQueZuoFa **: Gai ui/components/coordinate_picker_window.py QianXianDu this prompt and coordinate_picker_visual_improvements, coordinate_picker_improvements; BaoChiShi when Tong step , not in GuanBi when ChongFuTong step , YanSeJin #RRGGBB or fill=''; XiuGaiQianQingXianTongDu this note . 

---

## Er , docs/FLOW_IMPLEMENTATION_PROGRESS.md

- ** purpose **: LiangLiuChengKuShiXianJinDu (BN-only and Flow-master) . TongYiRuKou process_task() (TaskThread every 1s, 2s step by _flow_tick_count % 2) ; FenZhiErCiDu get_bn_only_enabled()/get_flow_master_enabled(); LiangKaiGuanKeTong when True, TongPaiXian BN-only Zai flow-master. ZhuangTai in rosbot_flow_state (flow_master_enabled, bn_only_enabled) ; game_interface_data.rosbot_flow_master_enabled/ensure_battlenet_only_master_enabled Jin by flow_state set XieRu . BN-only: refresh_battlenet, notify, tick_battlenet_ready_flow(no_activate=True); FanHuiZhi (done, result), done and result=="confirmed" reset_confirmed_to_poll. Flow-master: refresh BN/D3/ROSBOT ( item Jian ) , notify, extension_flow_tick_step, run_f0_prejudge_entry b1/b2/c1, tick_battlenet_ready_flow(no_activate=False), enter_battlenet_at_b2, F3/F4. check_window: is_flow_active() for True Ze return not ShuaXin ; FouZe refresh BN+D3, notify. 
- ** YiCuoDian **: Gai process_task, flow_bn_only, flow_master_driver, check_window, panel when WeiDu this DangHuiGaiShunXu or ZhiPaoQiYi , or in process_task within Xie flow_state, or check_window in is_flow_active() for True when Reng refresh; Gai provider FanHuiZhi when this DangXieMing refresh_* DangQian void, if JiaDing have FanHuiZhi and Xian have DaiMa not Fu ; Xu and FLOW_STATE_OWNERSHIP_DESIGN, ENSURE_BATTLENET_ONLY_TICK_FLOW to Zhao . 
- ** ZhengQueZuoFa **: GaiLiuChengCeng or state CengQianTongDu this Dang and FLOW_STATE_OWNERSHIP_DESIGN, ENSURE_BATTLENET_ONLY_TICK_FLOW; Gai extension_flow_tick_step, run_f0_prejudge_entry, tick_battlenet_ready_flow, run_f3_log_timeout etc. FanHuiZhiChuLi when to Zhao this DangBiaoGe ; RenWuKaiGuanJinGenJu get_flow_master_enabled/get_bn_only_enabled PaiSheng ; XiuGaiQianQingXianTongDu this note . 

---

## San , ui/utils/tk_variables.py

- ** purpose **: Tk BianLiangGongChang , BiMian "no default root window". var_bool(master, value), var_str(master, value), var_int(master, value), var_double(master, value); TkMaster = Union[tk.Widget, tk.Tk, tk.Toplevel], Suo have UI ChuangJian Tk BianLiangYingJingCi module and ChuanRuZhengQue master. 
- ** YiCuoDian **: in UI in ZhiJie tk.BooleanVar(), tk.StringVar() etc. no master HuiChuFa no default root window; ChuanRuCuoWu master ( such as None or Yi destroy widget) HuiBangDingCuo or BaoCuo ; newly added BianLiangLeiXingWeiTongGuo this module QieWeiChuan master HuiTongYangWenTi . 
- ** ZhengQueZuoFa **: Suo have XinJian BooleanVar/StringVar/IntVar/DoubleVar JunTongGuo tk_variables.var_*(master, value), master for DangQian widget or toplevel; XiuGaiQianQingXianTongDu this note . 

---

## Si , SanChu and apology document to Ying 

this note to YingZhuanShu apology document ** No. WuShiLiuJie ** and ZhangWen apology in " then coordinate_picker_data_consistency_fix, FLOW_IMPLEMENTATION_PROGRESS, tk_variables SanChu " of FenXi and apology segment . FaXianShangShuSanChuWenJian when , Ying continue GengXin to apology document ( technical note , ZhuanShuJie , ZhangWenZhuiJia ) . 
