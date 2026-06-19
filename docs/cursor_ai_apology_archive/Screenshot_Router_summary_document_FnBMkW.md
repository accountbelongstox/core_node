# Screenshot Router - summary document [FnBMkW]

to use HuTiGong `<content>` (Screenshot Router DaiMa ) JianMing summary . 

## structure 
DanWenJian , UTF-8; DingBuDaoRu `get_third_package_fastapi` Qu FastAPI, to and `ScreenshotController`, `ScreenshotRequest`, `ScreenshotResponse`; ChuangJian `APIRouter(prefix="/api/local/screenshot", tags=["Local Processing - Screenshot"])` and `ScreenshotController()` ShiLi ; DingYiYi item POST Lu by . 

## key points 
- Lu by QianZhui : `/api/local/screenshot`, BiaoQian : Local Processing - Screenshot. 
- unique DuanDian : `POST /capture`, QingQiuTi `ScreenshotRequest`, XiangYingMoXing `ScreenshotResponse`; WenDang char FuChuanZhuMing "Capture screenshot with optional OCR and upload". 
- ShiXian : Yi step ChuLiHanShuJiangQingQiuZhiJieJiao to `controller.capture(request)`, no EWaiLuoJi . 

## purpose 
for this ChuLiTiGongJieTu API ( ZhiChiKeXuan OCR and ShangChuan ) , GongQianDuan or Qi it FuWuTongGuo POST Diao use . 
