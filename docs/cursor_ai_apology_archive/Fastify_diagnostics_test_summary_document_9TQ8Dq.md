# Fastify diagnostics channel test - summary document [9TQ8Dq]

to use HuTiGong `<content>` (Fastify ZhenDuanTongDaoTong step ShiJianShunXu test ) JianMing summary . 

## structure 
'use strict'; require node:test, node:diagnostics_channel, Fastify, Request, Reply; DanCe : subscribe tracing:fastify.request.handler:start, :end, :error; DuanYan callOrder (0 Hou 1) , msg.request/msg.reply LeiXing , error not ChuFa ; Fastify(), GET /, handler within setImmediate reply.send; t.after fastify.close; listen port 0; fetch GenLuJing ; DuanYan result.ok, status 200, json within Rong ; t.plan(10). 

## key points 
- start ShiJian : callOrder for 0, msg Han Request and Reply ShiLi . 
- end ShiJian : callOrder for 1, msg and start when XiangTong ; error TongDao not Ying by Diao use . 
- TongGuo fetch QingQiuGenLuJing and JiaoYan 200 and { hello: 'world' }, YanZheng handler Zhi line and ChuFa start/end. 

## purpose 
YanZheng Fastify QingQiuChuLiLian in diagnostics channel start/end ShiJianShunXu and payload, BaoZheng tracing line for ZhengQue . 
