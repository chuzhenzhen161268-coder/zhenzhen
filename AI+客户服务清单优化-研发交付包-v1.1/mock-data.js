/**
 * mock-data.js — AI+客户服务清单 Demo 内联数据源（由 tools/build-mock-data.cjs 生成，请勿手工编辑）
 * 数据与 mock-data/*.json 逐字节同源（JSON 文件为数据基准，本文件为其 script 加载形态）。
 * 页面需在 mock-api.js 之前引入本文件：<script src="../mock-data.js"></script>
 * mock-api.js 读取顺序：window.MOCK_DB（file:// 可用）→ fetch mock-data/*.json（HTTP 兼容回退）。
 */
;(function () {
  window.MOCK_DB = window.MOCK_DB || {}

  window.MOCK_DB["page-data.json"] = {
  "_comment": "页面主数据 — 对应 GET /api/service/list 响应 result（PageDataResp）。数据还原自 src/features/ai-service-list/mock.ts。6 个客户覆盖：亏损未止损/亏损已止损/盈利了结/未签约四类信号、已完成客户（孙丽华 serveStatus=1）、画像无电话客户（武静 phoneNo=null，由 contacts 兜底）、低风险客户（林秀兰 C2，话术适用 C3 → 触发红色风险警示）。",
  "id": "PROC_001",
  "userId": "advisor_001",
  "processId": "PROC_001",
  "taskId": "1749991200000123456",
  "uuid": "G_wujing_001",
  "status": "in_progress",
  "sceneId": "SCENE_AI_SERVICE",
  "sceneName": "AI+客户服务清单",
  "templateType": "ai_service_list",
  "finalScript": "",
  "reviewRounds": 0,
  "regenerationsUsed": 0,
  "terminateReason": "",
  "reasonCode": "",
  "detail": "",
  "createTime": "2026-09-18T01:00:00+00:00",
  "businessLine": "AI+投顾",
  "customers": [
    {
      "uuid": "G_wujing_001",
      "clientId": "8881905747",
      "serveStatus": 0,
      "serveTime": null,
      "wxBroadcastStatus": 0,
      "wxBroadcastTime": null,
      "monthlySignalMetrics": { "winRate": "68.2%", "count": "15 个", "returnRate": "+4.8%" },
      "securityList": [
        {
          "securityType": "ETF",
          "securityCode": "300300",
          "securityName": "光伏ETF",
          "signalType": "loss_unstopped",
          "signalSubtype": [
            "亏损未止损"
          ],
          "scenario": "G1-01",
          "events": [
            {
              "label": "新能源调整：比亚迪发布新的车型Y2000",
              "type": "negative",
              "event_type": "",
              "content": "新能源板块今日大幅下跌，申万新能源指数跌2.8%，光伏、储能、充电桩子板块集体走弱，主要受欧洲补贴政策收紧及碳酸锂价格下行预期影响。"
            },
            {
              "label": "#美联储议息",
              "type": "negative",
              "event_type": "hotspot",
              "content": "美联储7月议息会议纪要显示官员倾向维持高利率，美元指数走强，对A股外资流向存在一定扰动。"
            }
          ],
          "sceneCode": "G1-01",
          "sceneScript": "您好！今日新能源板块出现较大异动，您跟随AI投ETF信号的光伏ETF属于该板块，受板块整体下跌影响，您的跟随仓位目前出现了浮亏。\n\n此次浮亏主要由板块下跌异动引起，属于板块性系统压力传导，并非信号本身失效。\n\n您当前跟随仓位占比不高（7.8%），建议继续持有观察，等待板块情绪修复后的反弹机会。同时也可关注下一期信号，通过分散配置降低单一标的波动对账户的影响。\n\n投资都会有起伏，您不用太担心。从AI投ETF上个月整体表现来看，系统捕捉的信号整体不错，这只票只是暂时处于震荡期。我会持续帮您跟踪，有操作机会第一时间提示您。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=515790&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=515790&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "159928",
          "securityName": "消费ETF",
          "signalType": "loss_stopped",
          "signalSubtype": [
            "亏损已止损"
          ],
          "scenario": "G2-01",
          "events": [
            {
              "label": "#大消费承压",
              "type": "negative",
              "event_type": "anomaly",
              "content": "大消费板块整体承压，受宏观经济数据偏弱及居民消费信心不足影响，零售、食品饮料等子板块跌幅居前。"
            }
          ],
          "sceneCode": "G2-01",
          "sceneScript": "您好！您跟随的消费ETF信号已触发止损，我主动跟您沟通一下。大消费板块近期出现明显回调，板块整体承压，您跟随的ETF随板块同步回调因此触发了止损。值得注意的是，及时止损已经避免了进一步亏损扩大。\n\n这次触发止损确实给您带来了一定损失，非常理解您的心情。止损机制的核心作用正是控制风险，避免更大亏损。接下来建议关注AI投ETF后续推送的新信号，通过分散配置降低单一标的波动影响；如需调整跟随仓位或频率，我们也可以重新评估您的风险偏好。\n\n从AI投ETF上个月整体表现来看，系统捕捉的信号整体不错，这只票是个例外。接下来我会持续帮您关注新的投资机会，有操作提示会及时与您沟通。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=159928&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=159928&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "159915",
          "securityName": "创业板ETF",
          "signalType": "loss_unstopped",
          "signalSubtype": [
            "亏损未止损"
          ],
          "scenario": "G1-04",
          "events": [
            {
              "label": "#创业板调整",
              "type": "negative",
              "event_type": "anomaly",
              "content": "创业板指数今日下跌1.5%，成长风格短期承压。"
            }
          ],
          "sceneCode": "G1-04",
          "sceneScript": "您好！今日创业板出现调整，您跟随的创业板ETF出现浮亏。建议继续持有观察。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=159915&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=159915&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "512660",
          "securityName": "军工ETF",
          "signalType": "loss_unstopped",
          "signalSubtype": [
            "亏损未止损"
          ],
          "scenario": "G1-05",
          "events": [
            {
              "label": "#军工回调",
              "type": "negative",
              "event_type": "anomaly",
              "content": "军工板块今日回调2.1%，受订单预期调整影响。"
            }
          ],
          "sceneCode": "G1-05",
          "sceneScript": "您好！军工板块近期回调，您跟随的军工ETF出现浮亏。概念仍受政策支持，建议持有观察。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=512660&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=512660&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "588000",
          "securityName": "科创50ETF",
          "signalType": "loss_unstopped",
          "signalSubtype": [
            "亏损未止损"
          ],
          "scenario": "G1-07",
          "events": [
            {
              "label": "#科创板调整",
              "type": "negative",
              "event_type": "anomaly",
              "content": "科创板今日跌幅超2%，科创50成分股普遍回调。"
            }
          ],
          "sceneCode": "G1-07",
          "sceneScript": "您好！科创50ETF近期回调，AI信号此前已给出卖出提示，但您当前未跟随卖出，持仓仍处于浮亏状态。\n\n从信号闭环看，若按提示卖出可避免进一步回撤。建议您结合自身风险承受能力评估是否补操作，后续我会持续帮您跟踪信号变化。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=588000&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=588000&type=ETF"
            }
          ]
        }
      ]
    },
    {
      "uuid": "G_chenjianguo_002",
      "clientId": "8872134561",
      "serveStatus": 0,
      "serveTime": null,
      "wxBroadcastStatus": 0,
      "wxBroadcastTime": null,
      "monthlySignalMetrics": { "winRate": "74.0%", "count": "12 个", "returnRate": "+6.5%" },
      "securityList": [
        {
          "securityType": "ETF",
          "securityCode": "512760",
          "securityName": "芯片ETF",
          "signalType": "profit_done",
          "signalSubtype": [
            "盈利已了结"
          ],
          "scenario": "G3-01",
          "events": [
            {
              "label": "#半导体大涨",
              "type": "positive",
              "event_type": "anomaly",
              "content": "半导体板块今日大幅上涨，申万半导体指数涨幅达3.7%，受益于国产替代政策及AI算力需求拉动，芯片设计、封测板块领涨。"
            },
            {
              "label": "#芯片ETF涨停",
              "type": "positive",
              "event_type": "anomaly",
              "content": "芯片ETF今日涨停，触发AI投ETF止盈信号，当前持仓客户已获得8.6%正收益。"
            }
          ],
          "sceneCode": "G3-01",
          "sceneScript": "您好！首先恭喜您，最近跟投的芯片ETF表现很不错！这只ETF所属的半导体板块近期出现向上异动，是本次信号盈利的重要驱动，您这次跟投的时机把握得很好。\n\n目前您这只ETF跟随仓位占比相对较高（13.2%），建议考虑阶段性止盈一部分，先锁定部分收益；剩余仓位可结合AI投ETF信号继续观察。\n\n从AI投ETF上个月整体表现来看，系统胜率相当不错（74%），您这次跟投成功也印证了信号的参考价值。接下来还会有新信号推出，建议继续保持关注、提高跟随率。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=512760&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=512760&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "512670",
          "securityName": "国防军工",
          "signalType": "loss_unstopped",
          "signalSubtype": [
            "亏损未止损"
          ],
          "scenario": "G1-06",
          "events": [
            {
              "label": "#军民融合调整",
              "type": "negative",
              "event_type": "anomaly",
              "content": "军民融合概念今日走弱，国防军工板块承压。"
            }
          ],
          "sceneCode": "G1-06",
          "sceneScript": "您好！军民融合概念近期走弱，您跟随的国防军工出现浮亏。建议持有观察。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=512670&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=512670&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "159901",
          "securityName": "创业大盘ETF",
          "signalType": "loss_unstopped",
          "signalSubtype": [
            "亏损未止损"
          ],
          "scenario": "G1-08",
          "events": [
            {
              "label": "#创业板调整",
              "type": "negative",
              "content": "创业大盘指数回调，成长风格承压。"
            }
          ],
          "sceneCode": "G1-08",
          "sceneScript": "您好！创业大盘ETF此前出现回调，您在亏损时提前卖出，但之后板块出现反弹，相比继续持有少回了部分本金。\n\n这类“卖早了”的情况在震荡市较常见，后续可结合AI信号的卖出提示节奏操作，避免提前离场错过反弹。我会持续帮您关注新的信号机会。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=159901&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=159901&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "159995",
          "securityName": "芯片ETF",
          "signalType": "loss_unstopped",
          "signalSubtype": [
            "亏损未止损"
          ],
          "scenario": "G1-09",
          "events": [
            {
              "label": "#芯片回调",
              "type": "negative",
              "content": "半导体板块今日回调1.8%，芯片ETF随板块走弱。"
            }
          ],
          "sceneCode": "G1-09",
          "sceneScript": "您好！芯片板块回调，您跟随的芯片ETF出现浮亏。当前止损价1.182元，建议持有观察。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=159995&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=159995&type=ETF"
            }
          ]
        }
      ]
    },
    {
      "uuid": "G_liuxiaomei_003",
      "clientId": "8863027489",
      "serveStatus": 0,
      "serveTime": null,
      "wxBroadcastStatus": 0,
      "wxBroadcastTime": null,
      "monthlySignalMetrics": { "winRate": "65.8%", "count": "19 个", "returnRate": "+3.2%" },
      "securityList": [
        {
          "securityType": "ETF",
          "securityCode": "510300",
          "securityName": "沪深300ETF",
          "signalType": "loss_unstopped",
          "signalSubtype": [
            "亏损未止损"
          ],
          "scenario": "G1-02",
          "events": [
            {
              "label": "#大盘整体调整",
              "type": "negative",
              "content": "上证指数今日下跌1.2%，沪深300同步走弱，受美联储偏鹰表态影响，外资净流出超50亿元，市场风险偏好整体回落。"
            },
            {
              "label": "#汇率扰动",
              "type": "negative",
              "content": "人民币兑美元汇率近期有所承压，对持有相关QDII产品的客户产生一定影响，建议关注汇率对净值的扰动。"
            }
          ],
          "sceneCode": "G1-02",
          "sceneScript": "您好！今日大盘整体出现调整，您跟随AI投ETF信号的沪深300ETF随市下行，目前跟随仓位出现了一定浮亏。\n\n此次浮亏主要受整体A股市场回调影响，属于市场系统性压力，与信号质量本身关系不大。\n\n目前您这只ETF跟随仓位占比较高（22.4%），建议适当降低仓位、控制单一标的风险。同时可关注下一期信号，通过分散配置降低波动影响。\n\n投资都会有起伏，您不用太担心。我会持续帮您跟踪，有操作机会会第一时间提示您。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=510300&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=510300&type=ETF"
            }
          ]
        },
        {
          "securityType": "stock",
          "securityCode": "600519",
          "securityName": "贵州茅台",
          "signalType": "profit_done",
          "signalSubtype": [
            "盈利已了结"
          ],
          "scenario": "G3-02",
          "events": [
            {
              "label": "#白酒板块回暖",
              "type": "positive",
              "content": "白酒板块受渠道库存改善及节日备货提振，本周累计涨幅超4%，贵州茅台、五粮液等核心标的表现突出。"
            }
          ],
          "sceneCode": "G3-02",
          "sceneScript": "您好！首先恭喜您，贵州茅台的这笔跟投表现很不错！白酒板块近期受渠道库存改善提振，茅台近期走势强劲，本次信号已盈利了结。\n\n您当前跟随仓位占比不高（6.8%），且白酒板块目前仍处于市场关注方向，可以继续持有观察；如果后续出现合理回调，也可结合AI投ETF信号考虑是否适当加仓。\n\n从AI投ETF上个月整体表现来看，系统胜率还不错，您这次跟投成功也印证了信号的参考价值。接下来还会有新信号推出，建议继续保持关注。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=600519&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=600519&type=stock"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "510500",
          "securityName": "中证500ETF",
          "signalType": "loss_unstopped",
          "signalSubtype": [
            "亏损未止损"
          ],
          "scenario": "G1-03",
          "events": [
            {
              "label": "#中小盘承压",
              "type": "negative",
              "content": "中小盘风格今日表现偏弱，中证500指数跌幅超沪深300，资金向蓝筹方向集中，成长风格短期承压。"
            }
          ],
          "sceneCode": "G1-03",
          "sceneScript": "您好！今日中小盘风格整体承压，您跟随的中证500ETF受风格切换影响，目前出现了一定浮亏。\n\n此次浮亏属于风格轮动导致的短期承压，信号尚未触发止损，当前止损价格为5.878元，后续重点关注是否接近止损位。\n\n您当前跟随仓位占比不高（9.1%），建议继续持有观察，等待市场风格切换后的修复机会。同时也可关注下一期信号，通过分散配置降低单一标的波动对账户的影响。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=510500&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=510500&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "515050",
          "securityName": "AI主题ETF",
          "signalType": "loss_unstopped",
          "signalSubtype": [
            "亏损未止损"
          ],
          "scenario": "G1-10",
          "events": [
            {
              "label": "#AI板块调整",
              "type": "negative",
              "content": "AI概念板块今日回调，前期涨幅较大获利了结。"
            }
          ],
          "sceneCode": "G1-10",
          "sceneScript": "您好！AI板块近期回调，您跟随的AI主题ETF出现浮亏。建议持有观察。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=515050&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=515050&type=ETF"
            }
          ]
        },
        {
          "securityType": "stock",
          "securityCode": "600036",
          "securityName": "招商银行",
          "signalType": "loss_stopped",
          "signalSubtype": [
            "亏损已止损"
          ],
          "scenario": "G2-02",
          "events": [
            {
              "label": "#银行板块承压",
              "type": "negative",
              "content": "银行板块整体承压，受LPR下调及息差收窄预期影响。"
            }
          ],
          "sceneCode": "G2-02",
          "sceneScript": "您好！您跟随的招商银行信号已触发止损。银行板块近期承压，后续关注新信号机会。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=600036&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=600036&type=stock"
            }
          ]
        },
        {
          "securityType": "stock",
          "securityCode": "601318",
          "securityName": "中国平安",
          "signalType": "loss_stopped",
          "signalSubtype": [
            "亏损已止损"
          ],
          "scenario": "G2-03",
          "events": [
            {
              "label": "#保险板块回调",
              "type": "negative",
              "content": "保险板块今日回调，受长端利率下行影响。"
            }
          ],
          "sceneCode": "G2-03",
          "sceneScript": "您好！您跟随的中国平安信号已触发止损。保险板块近期承压，后续关注新信号机会。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=601318&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=601318&type=stock"
            }
          ]
        }
      ]
    },
    {
      "uuid": "G_zhaomingyuan_004",
      "clientId": "8854918302",
      "serveStatus": 0,
      "serveTime": null,
      "wxBroadcastStatus": 0,
      "wxBroadcastTime": null,
      "securityList": [
        {
          "securityType": "ETF",
          "securityCode": "512010",
          "securityName": "医药ETF",
          "signalType": "unsigned",
          "signalSubtype": [
            "未签约开发"
          ],
          "signalReturn": 12.6,
          "scenario": "G4-01",
          "events": [
            {
              "label": "#医药ETF热点",
              "type": "positive",
              "content": "医药板块今日获增量资金关注，CXO、创新药细分方向领涨，AI+医疗概念持续活跃，申万医药指数涨幅1.6%。"
            },
            {
              "label": "#创新药政策利好",
              "type": "positive",
              "content": "国家药监局最新公告显示将进一步加快创新药审批流程，相关政策预计下月正式落地，医药板块长期逻辑持续向好。"
            }
          ],
          "sceneCode": "G4-01",
          "sceneScript": "您好！今天系统提示，您持有的医药ETF属于近期市场关注度较高的医疗健康主题，这类方向近期有一定热点机会，我结合ETF诊断帮您看了一下当前情况。\n\nETF底层核心成分股中，爱尔眼科、迈瑞医疗近期受益于创新药政策利好，表现较为亮眼。AI投ETF系统之前也给出过这只ETF的相关信号，从历史信号表现来看，当时如果跟投收益还是比较可观的（近半年胜率72%），说明AI投ETF对您当前持仓有一定跟踪和提示价值。\n\n基于刚才的沟通，建议您了解一下我司的AI+投顾服务。AI+投顾会在AI投ETF信号基础上，由我结合您的持仓情况做进一步提醒和跟踪服务，以后有持仓相关信号我会第一时间提示您，让您不错过重要机会。要不我给您详细介绍一下AI+服务的具体内容和资费？",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=512010&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=512010&type=ETF"
            }
          ],
          "serviceRef": [
            {
              "title": "AI投顾服务介绍",
              "text": "AI投顾服务基于量化模型和大数据分析，为客户提供个股信号推送服务。系统每日扫描全市场标的，结合技术面、基本面及市场情绪综合评分，筛选出具备短期上涨潜力的个股，以买入信号形式推送给订阅客户，并配套止盈止损参数，帮助客户把握交易机会、控制投资风险。"
            },
            {
              "title": "AI+投顾服务介绍",
              "text": "AI+投顾服务在AI投顾信号基础上，引入专属投顾一对一跟踪服务。签约后，投顾将结合客户持仓情况和风险偏好，在信号触发时第一时间主动联系客户，提供个性化的操作建议和持仓诊断，让客户不错过每一个重要的投资机会。资费详情请咨询您的专属投顾。"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "512800",
          "securityName": "银行ETF",
          "signalType": "loss_stopped",
          "signalSubtype": [
            "亏损已止损"
          ],
          "scenario": "G2-04",
          "events": [
            {
              "label": "#银行板块调整",
              "type": "negative",
              "content": "银行板块今日下跌1.2%，受息差收窄预期影响。"
            }
          ],
          "sceneCode": "G2-04",
          "sceneScript": "您好！您跟随的银行ETF信号已触发止损。银行板块近期承压，后续关注新信号机会。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=512800&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=512800&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "512690",
          "securityName": "酒ETF",
          "signalType": "profit_done",
          "signalSubtype": [
            "盈利已了结"
          ],
          "scenario": "G3-04",
          "events": [
            {
              "label": "#白酒板块回暖",
              "type": "positive",
              "content": "白酒板块受渠道库存改善提振，本周累计涨幅超3%。"
            }
          ],
          "sceneCode": "G3-04",
          "sceneScript": "您好！恭喜您，酒ETF这笔跟投收益不错。白酒板块近期回暖，建议继续关注后续机会。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=512690&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=512690&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "512000",
          "securityName": "券商ETF",
          "signalType": "unsigned",
          "signalSubtype": [
            "未签约"
          ],
          "scenario": "G4-03",
          "events": [
            {
              "label": "#券商板块机会",
              "type": "positive",
              "content": "券商板块受益于资本市场改革深化，估值修复空间较大。"
            }
          ],
          "sceneCode": "G4-03",
          "sceneScript": "您好！您持有的券商ETF属于近期市场关注度较高的方向，建议了解AI+投顾服务获取更多信号提示。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=512000&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=512000&type=ETF"
            }
          ]
        }
      ]
    },
    {
      "uuid": "G_sunlihua_005",
      "clientId": "8845736218",
      "serveStatus": 1,
      "serveTime": "2026-09-18T10:23:00+08:00",
      "wxBroadcastStatus": 0,
      "wxBroadcastTime": null,
      "monthlySignalMetrics": { "winRate": "71.6%", "count": "16 个", "returnRate": "+7.1%" },
      "securityList": [
        {
          "securityType": "ETF",
          "securityCode": "518880",
          "securityName": "黄金ETF",
          "signalType": "profit_done",
          "signalSubtype": [
            "盈利已了结"
          ],
          "scenario": "G3-03",
          "events": [
            {
              "label": "#黄金创新高",
              "type": "positive",
              "content": "国际金价突破2480美元/盎司，创历史新高，受美联储降息预期升温及地缘政治避险情绪推动，黄金ETF大幅上涨。"
            }
          ],
          "sceneCode": "G3-03",
          "sceneScript": "您好！首先恭喜您，黄金ETF这笔跟投收益非常不错！国际金价近期受美联储降息预期及避险情绪推动，突破历史高位，本次信号已顺利盈利了结（+8.1%）。\n\n您当前跟随仓位占比不高（8.5%），黄金作为避险资产目前仍受市场关注，可以继续持有观察；如果后续出现合理回调，也可结合AI投ETF信号考虑是否适当加仓。\n\n从AI投ETF上个月整体表现来看，系统胜率还不错（70%），您这次跟投成功也印证了信号的参考价值。接下来还会有新信号推出，建议继续保持关注、提高跟随率。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=518880&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=518880&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "159925",
          "securityName": "创业50ETF",
          "signalType": "profit_done",
          "signalSubtype": [
            "盈利已了结"
          ],
          "scenario": "G3-05",
          "events": [
            {
              "label": "#创业板反弹",
              "type": "positive",
              "content": "创业板指数反弹2.5%，创业50成分股表现亮眼。"
            }
          ],
          "sceneCode": "G3-05",
          "sceneScript": "您好！恭喜您，创业50ETF这笔跟投收益不错。创业板近期反弹，建议关注后续机会。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=159925&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=159925&type=ETF"
            }
          ]
        },
        {
          "securityType": "ETF",
          "securityCode": "512480",
          "securityName": "半导体ETF",
          "signalType": "profit_done",
          "signalSubtype": [
            "盈利已了结"
          ],
          "scenario": "G3-06",
          "events": [
            {
              "label": "#半导体上涨",
              "type": "positive",
              "content": "半导体板块今日大涨3.2%，国产替代逻辑持续兑现。"
            }
          ],
          "sceneCode": "G3-06",
          "sceneScript": "您好！恭喜您，半导体ETF这笔跟投收益不错。半导体板块表现强劲，建议继续关注。",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=512480&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=512480&type=ETF"
            }
          ]
        }
      ]
    },
    {
      "uuid": "G_linxiulan_006",
      "clientId": "8837654921",
      "serveStatus": 0,
      "serveTime": null,
      "wxBroadcastStatus": 0,
      "wxBroadcastTime": null,
      "securityList": [
        {
          "securityType": "ETF",
          "securityCode": "510880",
          "securityName": "红利ETF",
          "signalType": "unsigned",
          "signalSubtype": [
            "未签约"
          ],
          "signalReturn": 9.8,
          "scenario": "G4-02",
          "events": [
            {
              "label": "#高股息策略",
              "type": "positive",
              "content": "市场波动加大背景下，高股息资产配置价值凸显，红利类ETF近期资金持续净流入。"
            }
          ],
          "sceneCode": "G4-02",
          "sceneScript": "您好！最近市场上出现了几个值得关注的投资机会信号，表现比较稳健，很适合作为资产配置的补充。看您目前还未开通相关跟投服务，方便的话我可以先给您简单介绍一下产品逻辑和风险特征，您感兴趣的话我们可以约个时间详细聊聊～",
          "diagnosisUrls": [
            {
              "sector": "https://workbuddy.gjzq.com.cn/diag?code=510880&type=sector",
              "underlying": "https://workbuddy.gjzq.com.cn/diag?code=510880&type=ETF"
            }
          ]
        }
      ]
    }
  ],
  "customerPortraits": [
    {
      "uuid": "G_wujing_001",
      "clientId": "8881905747",
      "customerName": "武静",
      "customerGender": "女",
      "customerLevel": "高客四星",
      "customerRiskLevel": "C4 中高风险",
      "customerStyle": "价值型",
      "accountNo": "8881905747",
      "phoneNo": null,
      "totalAsset": "1,7897,9000.99",
      "holdingAsset": "7893000"
    },
    {
      "uuid": "G_chenjianguo_002",
      "clientId": "8872134561",
      "customerName": "陈建国",
      "customerGender": "男",
      "customerLevel": "高客三星",
      "customerRiskLevel": "C5 激进型",
      "customerStyle": "成长型",
      "accountNo": "8872134561",
      "phoneNo": "13801234567",
      "totalAsset": "3421600",
      "holdingAsset": "3385000"
    },
    {
      "uuid": "G_liuxiaomei_003",
      "clientId": "8863027489",
      "customerName": "刘晓梅",
      "customerGender": "女",
      "customerLevel": "高客五星",
      "customerRiskLevel": "C4 中高风险",
      "customerStyle": "稳健型",
      "accountNo": "8863027489",
      "phoneNo": "13912345678",
      "totalAsset": "1,2356,8800.99",
      "holdingAsset": "21004000"
    },
    {
      "uuid": "G_zhaomingyuan_004",
      "clientId": "8854918302",
      "customerName": "赵明远",
      "customerGender": "男",
      "customerLevel": "普通客户",
      "customerRiskLevel": "C3 平衡型",
      "customerStyle": "指数增强",
      "accountNo": "8854918302",
      "phoneNo": "13645678901",
      "totalAsset": "1284200",
      "holdingAsset": "1221000"
    },
    {
      "uuid": "G_sunlihua_005",
      "clientId": "8845736218",
      "customerName": "孙丽华",
      "customerGender": "女",
      "customerLevel": "高客二星",
      "customerRiskLevel": "C3 平衡型",
      "customerStyle": "价值型",
      "accountNo": "8845736218",
      "phoneNo": "15823456789",
      "totalAsset": "5163000",
      "holdingAsset": "4800000"
    },
    {
      "uuid": "G_linxiulan_006",
      "clientId": "8837654921",
      "customerName": "林秀兰",
      "customerGender": "女",
      "customerLevel": "普通客户",
      "customerRiskLevel": "C2 谨慎型",
      "customerStyle": "稳健型",
      "accountNo": "8837654921",
      "phoneNo": "13512348899",
      "totalAsset": "864000",
      "holdingAsset": "621000"
    }
  ]
}

  window.MOCK_DB["tasks.json"] = {
  "_comment": "待办任务 — 对应 POST /ismpgw/ims-middleware-callout/callout/task/list 响应 result（ClientTasksResp）。key 为 clientId。endTime 格式 YYYY.MM.DD（ISMP V1 契约），前端 transformTask 转换为 YYYY-MM-DD 用于逾期判定。6 客户任务分布：武静 2 条（含紧急必做）、陈建国 0 条（空任务边界）、刘晓梅 3 条、赵明远 1 条非必做、孙丽华 0 条、林秀兰 1 条。注意：endTime 为 2026.07.x，相对 demo 运行日（2026-09-18）均逾期 → 任务行右侧显示红色「逾期 07-XX」。",
  "8881905747": {
    "total": 2,
    "list": [
      {
        "taskId": 15865,
        "templateId": 1149,
        "taskName": "SOP-AI投ETF产品退订挽留",
        "startTime": "2026.07.01",
        "endTime": "2026.07.07",
        "mustDo": 1,
        "mustDoDesc": "必做",
        "priority": 9,
        "priorityDesc": "紧急",
        "appointment": 1,
        "appointmentDesc": "是",
        "taskDesc": "1.AI投ETF退订（目前AI+未上线退订，暂不推送）2.剔除近三月接通率=0的客户且近三月外呼次数≥3次"
      },
      {
        "taskId": 15866,
        "templateId": 1150,
        "taskName": "风险测评过期",
        "startTime": "2026.07.01",
        "endTime": "2026.07.10",
        "mustDo": 1,
        "mustDoDesc": "必做",
        "priority": 3,
        "priorityDesc": "一般",
        "appointment": 1,
        "appointmentDesc": "是",
        "taskDesc": "客户风险测评已超过有效期，需提醒客户完成重新测评"
      }
    ]
  },
  "8872134561": {
    "total": 0,
    "list": []
  },
  "8863027489": {
    "total": 3,
    "list": [
      {
        "taskId": 15867,
        "templateId": 1149,
        "taskName": "SOP-AI投ETF产品退订挽留",
        "startTime": "2026.07.01",
        "endTime": "2026.07.06",
        "mustDo": 1,
        "mustDoDesc": "必做",
        "priority": 9,
        "priorityDesc": "紧急",
        "appointment": 1,
        "appointmentDesc": "是",
        "taskDesc": "1.AI投ETF退订（目前AI+未上线退订，暂不推送）2.剔除近三月接通率=0的客户且近三月外呼次数≥3次"
      },
      {
        "taskId": 15868,
        "templateId": 2099,
        "taskName": "理财产品即将到期",
        "startTime": "2026.07.01",
        "endTime": "2026.07.08",
        "mustDo": 1,
        "mustDoDesc": "必做",
        "priority": 9,
        "priorityDesc": "紧急",
        "appointment": 1,
        "appointmentDesc": "是",
        "taskDesc": "客户持有的理财产品将于近期到期，需提前沟通续期或转购意向"
      },
      {
        "taskId": 15869,
        "templateId": 1150,
        "taskName": "风险测评过期",
        "startTime": "2026.07.01",
        "endTime": "2026.07.15",
        "mustDo": 1,
        "mustDoDesc": "必做",
        "priority": 3,
        "priorityDesc": "一般",
        "appointment": 1,
        "appointmentDesc": "是",
        "taskDesc": "客户风险测评已超过有效期，需提醒客户完成重新测评"
      }
    ]
  },
  "8854918302": {
    "total": 1,
    "list": [
      {
        "taskId": 15870,
        "templateId": 1150,
        "taskName": "风险测评过期",
        "startTime": "2026.07.01",
        "endTime": "2026.07.12",
        "mustDo": 0,
        "mustDoDesc": "非必做",
        "priority": 3,
        "priorityDesc": "一般",
        "appointment": 1,
        "appointmentDesc": "是",
        "taskDesc": "客户风险测评已超过有效期，需提醒客户完成重新测评"
      }
    ]
  },
  "8845736218": {
    "total": 0,
    "list": []
  },
  "8837654921": {
    "total": 1,
    "list": [
      {
        "taskId": 15871,
        "templateId": 1150,
        "taskName": "风险测评过期",
        "startTime": "2026.07.01",
        "endTime": "2026.07.11",
        "mustDo": 1,
        "mustDoDesc": "必做",
        "priority": 3,
        "priorityDesc": "一般",
        "appointment": 1,
        "appointmentDesc": "是",
        "taskDesc": "客户风险测评已超过有效期，需提醒客户完成重新测评"
      }
    ]
  }
}

  window.MOCK_DB["contacts.json"] = {
  "_comment": "客户联系电话 — 对应 POST /ismpgw/ims-middleware-callout/callout/task/selectContactsList 响应 result（IContactInfoResult）。key 为 clientId。注意：武静画像 phoneNo=null，本接口返回 type='1' 联系电话 17386175368 作为兜底展示与外呼号码（对应源码 AiServiceListPage handleCall：contacts type=1 优先于画像 phoneNo）。last_contact 为上次通话接通状态。",
  "8881905747": {
    "client_name": "武静",
    "client_gender": "女",
    "list": [
      {
        "phone": "17386175368",
        "last_contact": "接通",
        "type": "1",
        "type_name": "联系电话",
        "isNative": null,
        "custName": null,
        "clientId": null,
        "isBlack": null,
        "sort": 1,
        "isChecked": false
      },
      {
        "phone": "17386170000",
        "last_contact": null,
        "type": "3",
        "type_name": "交易留存电话",
        "isNative": null,
        "custName": null,
        "clientId": null,
        "isBlack": null,
        "sort": 3,
        "isChecked": false
      }
    ]
  },
  "8872134561": {
    "client_name": "陈建国",
    "client_gender": "男",
    "list": [
      {
        "phone": "13801234567",
        "last_contact": "接通",
        "type": "1",
        "type_name": "联系电话",
        "isNative": null,
        "custName": null,
        "clientId": null,
        "isBlack": null,
        "sort": 1,
        "isChecked": false
      },
      {
        "phone": "13801230000",
        "last_contact": null,
        "type": "3",
        "type_name": "交易留存电话",
        "isNative": null,
        "custName": null,
        "clientId": null,
        "isBlack": null,
        "sort": 3,
        "isChecked": false
      }
    ]
  },
  "8863027489": {
    "client_name": "刘晓梅",
    "client_gender": "女",
    "list": [
      {
        "phone": "13912345678",
        "last_contact": "未接通",
        "type": "1",
        "type_name": "联系电话",
        "isNative": null,
        "custName": null,
        "clientId": null,
        "isBlack": null,
        "sort": 1,
        "isChecked": false
      }
    ]
  },
  "8854918302": {
    "client_name": "赵明远",
    "client_gender": "男",
    "list": [
      {
        "phone": "13645678901",
        "last_contact": "接通",
        "type": "1",
        "type_name": "联系电话",
        "isNative": null,
        "custName": null,
        "clientId": null,
        "isBlack": null,
        "sort": 1,
        "isChecked": false
      }
    ]
  },
  "8845736218": {
    "client_name": "孙丽华",
    "client_gender": "女",
    "list": [
      {
        "phone": "15823456789",
        "last_contact": null,
        "type": "1",
        "type_name": "联系电话",
        "isNative": null,
        "custName": null,
        "clientId": null,
        "isBlack": null,
        "sort": 1,
        "isChecked": false
      }
    ]
  },
  "8837654921": {
    "client_name": "林秀兰",
    "client_gender": "女",
    "list": [
      {
        "phone": "13512348899",
        "last_contact": "接通",
        "type": "1",
        "type_name": "联系电话",
        "isNative": null,
        "custName": null,
        "clientId": null,
        "isBlack": null,
        "sort": 1,
        "isChecked": false
      }
    ]
  }
}

  window.MOCK_DB["market-data.json"] = [
  {
    "sceneCode": "G1-01",
    "securityCode": "515790",
    "fieldsMap": {
      "closeWinRate": 0.72,
      "closedProfitSignalCount": 15,
      "totalProductReturnRate": 0.068,
      "signalDirection": "1",
      "followAmount": "50000",
      "followType": "full",
      "followTime": "2026-06-15T09:30:00+08:00"
    }
  },
  {
    "sceneCode": "G2-01",
    "securityCode": "159928",
    "fieldsMap": {
      "closeWinRate": 0.65,
      "closedProfitSignalCount": 12,
      "totalProductReturnRate": 0.042,
      "signalDirection": "2",
      "followAmount": "30000",
      "followType": "partial",
      "followTime": "2026-05-10T09:30:00+08:00"
    }
  },
  {
    "sceneCode": "G3-01",
    "securityCode": "512760",
    "fieldsMap": {
      "closeWinRate": 0.74,
      "closedProfitSignalCount": 18,
      "totalProductReturnRate": 0.068,
      "signalDirection": "1",
      "followAmount": "20000",
      "followType": "full",
      "followTime": "2026-05-20T09:30:00+08:00",
      "buyPrice": 1.432,
      "takeProfitPrice": 1.555,
      "profitRate": 0.086,
      "costPrice": 1.451,
      "totalProfitRate": 0.072,
      "thsConceptCode": "半导体",
      "thsConceptName": "半导体"
    }
  },
  {
    "sceneCode": "G1-02",
    "securityCode": "510300",
    "fieldsMap": {
      "closeWinRate": 0.72,
      "closedProfitSignalCount": 15,
      "totalProductReturnRate": 0.068,
      "signalDirection": "1",
      "followAmount": "50000",
      "followType": "full",
      "followTime": "2026-06-15T09:30:00+08:00"
    }
  },
  {
    "sceneCode": "G3-02",
    "securityCode": "600519",
    "fieldsMap": {
      "closeWinRate": 0.68,
      "closedProfitSignalCount": 14,
      "totalProductReturnRate": 0.059,
      "signalDirection": "1",
      "followAmount": "120000",
      "followType": "full",
      "followTime": "2026-03-10T09:30:00+08:00",
      "buyPrice": 1682,
      "takeProfitPrice": 1824.5,
      "profitRate": 0.085,
      "costPrice": 1695,
      "totalProfitRate": 0.077,
      "thsConceptCode": "白酒",
      "thsConceptName": "白酒"
    }
  },
  {
    "sceneCode": "G1-03",
    "securityCode": "510500",
    "fieldsMap": {
      "closeWinRate": 0.72,
      "closedProfitSignalCount": 15,
      "totalProductReturnRate": 0.068,
      "signalDirection": "1",
      "followAmount": "50000",
      "followType": "full",
      "followTime": "2026-06-15T09:30:00+08:00"
    }
  },
  {
    "sceneCode": "G4-01",
    "securityCode": "512010",
    "fieldsMap": {
      "signalDirection": "1",
      "buyPrice": 0.812,
      "signalContent": "医药板块近期获增量资金关注，CXO、创新药细分方向领涨，AI+医疗概念持续活跃。",
      "closeWinRate": 0.72,
      "closedProfitSignalCount": 14,
      "openDate": "2024-11-08",
      "saleDate": "2024-12-02",
      "profitRate": 0.183,
      "thsConceptCode": "医疗健康",
      "thsConceptName": "医疗健康",
      "serviceDescAI": "AI投顾服务基于量化模型和大数据分析，为客户提供个股信号推送服务。",
      "serviceDescAIPlus": "AI+投顾服务在AI投顾信号基础上，引入专属投顾一对一跟踪服务。"
    }
  },
  {
    "sceneCode": "G3-03",
    "securityCode": "518880",
    "fieldsMap": {
      "closeWinRate": 0.7,
      "closedProfitSignalCount": 16,
      "totalProductReturnRate": 0.054,
      "signalDirection": "1",
      "followAmount": "50000",
      "followType": "full",
      "followTime": "2026-04-20T09:30:00+08:00",
      "buyPrice": 5.32,
      "takeProfitPrice": 5.751,
      "profitRate": 0.081,
      "costPrice": 5.334,
      "totalProfitRate": 0.078,
      "thsConceptCode": "黄金",
      "thsConceptName": "黄金"
    }
  },
  {
    "sceneCode": "G4-02",
    "securityCode": "510880",
    "fieldsMap": {
      "signalDirection": "1",
      "buyPrice": 2.654,
      "signalContent": "高股息策略在市场波动加大背景下配置价值凸显，红利类ETF近期资金持续净流入。",
      "closeWinRate": 0.68,
      "closedProfitSignalCount": 12,
      "openDate": "2024-09-10",
      "saleDate": "2024-10-15",
      "profitRate": 0.062,
      "thsConceptCode": "红利",
      "thsConceptName": "红利",
      "serviceDescAI": "AI投顾服务基于量化模型和大数据分析，为客户提供个股信号推送服务。",
      "serviceDescAIPlus": "AI+投顾服务在AI投顾信号基础上，引入专属投顾一对一跟踪服务。"
    }
  },
  {
    "sceneCode": "G1-04",
    "securityCode": "159915",
    "fieldsMap": {
      "closeWinRate": 0.66,
      "closedProfitSignalCount": 13,
      "totalProductReturnRate": 0.048,
      "signalDirection": "1",
      "followAmount": "40000",
      "followType": "full",
      "followTime": "2026-06-10T09:30:00+08:00"
    }
  },
  {
    "sceneCode": "G1-05",
    "securityCode": "512660",
    "fieldsMap": {
      "closeWinRate": 0.69,
      "closedProfitSignalCount": 16,
      "totalProductReturnRate": 0.061,
      "signalDirection": "1",
      "followAmount": "35000",
      "followType": "partial",
      "followTime": "2026-06-08T09:30:00+08:00",
      "thsConceptCode": "军工",
      "thsConceptName": "国防军工",
      "popularConcepts": "[{\"rankType\":\"4\",\"rank\":1,\"code\":\"GN6101.BK\",\"name\":\"兵装重组概念\"},{\"rankType\":\"4\",\"rank\":2,\"code\":\"GN0462.BK\",\"name\":\"创新药\"},{\"rankType\":\"4\",\"rank\":3,\"code\":\"GN6108.BK\",\"name\":\"AI应用\"},{\"rankType\":\"4\",\"rank\":5,\"code\":\"GN0274.BK\",\"name\":\"PCB概念\"},{\"rankType\":\"4\",\"rank\":6,\"code\":\"GN0482.BK\",\"name\":\"共封装光学(CPO)\"},{\"rankType\":\"4\",\"rank\":7,\"code\":\"GN0201.BK\",\"name\":\"猪肉\"},{\"rankType\":\"4\",\"rank\":8,\"code\":\"GN0293.BK\",\"name\":\"CRO概念\"},{\"rankType\":\"4\",\"rank\":9,\"code\":\"GN0491.BK\",\"name\":\"存储芯片\"},{\"rankType\":\"4\",\"rank\":10,\"code\":\"GN0350.BK\",\"name\":\"商业航天\"},{\"rankType\":\"4\",\"rank\":11,\"code\":\"GN0038.BK\",\"name\":\"黄金概念\"},{\"rankType\":\"4\",\"rank\":12,\"code\":\"GN0488.BK\",\"name\":\"算力租赁\"},{\"rankType\":\"4\",\"rank\":13,\"code\":\"GN0538.BK\",\"name\":\"人形机器人\"},{\"rankType\":\"4\",\"rank\":14,\"code\":\"GN0286.BK\",\"name\":\"乳业\"},{\"rankType\":\"4\",\"rank\":15,\"code\":\"GN0447.BK\",\"name\":\"机器人概念\"},{\"rankType\":\"4\",\"rank\":16,\"code\":\"GN0282.BK\",\"name\":\"养鸡\"},{\"rankType\":\"4\",\"rank\":17,\"code\":\"GN0290.BK\",\"name\":\"白酒概念\"},{\"rankType\":\"4\",\"rank\":18,\"code\":\"GN0161.BK\",\"name\":\"小金属概念\"},{\"rankType\":\"4\",\"rank\":19,\"code\":\"GN0001.BK\",\"name\":\"军工\"},{\"rankType\":\"4\",\"rank\":20,\"code\":\"GN6084.BK\",\"name\":\"光纤概念\"}]"
    }
  },
  {
    "sceneCode": "G1-07",
    "securityCode": "588000",
    "fieldsMap": {
      "closeWinRate": 0.63,
      "closedProfitSignalCount": 11,
      "totalProductReturnRate": 0.039,
      "signalDirection": "2",
      "followAmount": "45000",
      "followType": "full",
      "followTime": "2026-05-15T09:30:00+08:00",
      "signalTime": "2026-07-01T10:00:00+08:00",
      "sellPrice": 0.985,
      "profitRate": -0.048,
      "totalProfitRate": -0.048,
      "totalProfit": -2160
    }
  },
  {
    "sceneCode": "G1-06",
    "securityCode": "512670",
    "fieldsMap": {
      "closeWinRate": 0.67,
      "closedProfitSignalCount": 14,
      "totalProductReturnRate": 0.055,
      "signalDirection": "1",
      "followAmount": "25000",
      "followType": "full",
      "followTime": "2026-06-05T09:30:00+08:00",
      "thsConceptCode": "国防军工",
      "thsConceptName": "国防军工",
      "popularConcepts": "[{\"rankType\":\"4\",\"rank\":1,\"code\":\"GN6101.BK\",\"name\":\"兵装重组概念\"},{\"rankType\":\"4\",\"rank\":2,\"code\":\"GN0462.BK\",\"name\":\"创新药\"},{\"rankType\":\"4\",\"rank\":3,\"code\":\"GN6108.BK\",\"name\":\"AI应用\"},{\"rankType\":\"4\",\"rank\":5,\"code\":\"GN0274.BK\",\"name\":\"PCB概念\"},{\"rankType\":\"4\",\"rank\":6,\"code\":\"GN0482.BK\",\"name\":\"共封装光学(CPO)\"},{\"rankType\":\"4\",\"rank\":7,\"code\":\"GN0201.BK\",\"name\":\"猪肉\"},{\"rankType\":\"4\",\"rank\":8,\"code\":\"GN0293.BK\",\"name\":\"CRO概念\"},{\"rankType\":\"4\",\"rank\":9,\"code\":\"GN0491.BK\",\"name\":\"存储芯片\"},{\"rankType\":\"4\",\"rank\":10,\"code\":\"GN0350.BK\",\"name\":\"商业航天\"},{\"rankType\":\"4\",\"rank\":11,\"code\":\"GN0038.BK\",\"name\":\"黄金概念\"},{\"rankType\":\"4\",\"rank\":12,\"code\":\"GN0488.BK\",\"name\":\"算力租赁\"},{\"rankType\":\"4\",\"rank\":13,\"code\":\"GN0538.BK\",\"name\":\"人形机器人\"},{\"rankType\":\"4\",\"rank\":14,\"code\":\"GN0286.BK\",\"name\":\"乳业\"},{\"rankType\":\"4\",\"rank\":15,\"code\":\"GN0447.BK\",\"name\":\"机器人概念\"},{\"rankType\":\"4\",\"rank\":16,\"code\":\"GN0282.BK\",\"name\":\"养鸡\"},{\"rankType\":\"4\",\"rank\":17,\"code\":\"GN0290.BK\",\"name\":\"白酒概念\"},{\"rankType\":\"4\",\"rank\":18,\"code\":\"GN0161.BK\",\"name\":\"小金属概念\"},{\"rankType\":\"4\",\"rank\":19,\"code\":\"GN0001.BK\",\"name\":\"军工\"},{\"rankType\":\"4\",\"rank\":20,\"code\":\"GN6084.BK\",\"name\":\"光纤概念\"}]"
    }
  },
  {
    "sceneCode": "G1-08",
    "securityCode": "159901",
    "fieldsMap": {
      "closeWinRate": 0.64,
      "closedProfitSignalCount": 12,
      "totalProductReturnRate": 0.041,
      "signalDirection": "2",
      "followAmount": "30000",
      "followType": "partial",
      "followTime": "2026-05-20T09:30:00+08:00",
      "sellPrice": 1.125,
      "profitRate": -0.032,
      "closeProfitRate": -0.028,
      "closeAvgPrice": 1.158,
      "floatingProfit": -960,
      "closeProfit": -840,
      "entrustPrice": 1.125
    }
  },
  {
    "sceneCode": "G1-09",
    "securityCode": "159995",
    "fieldsMap": {
      "closeWinRate": 0.71,
      "closedProfitSignalCount": 17,
      "totalProductReturnRate": 0.072,
      "signalDirection": "1",
      "followAmount": "55000",
      "followType": "full",
      "followTime": "2026-06-18T09:30:00+08:00",
      "buyPrice": 1.258,
      "stopLossPrice": 1.182,
      "profitRate": -0.045,
      "Last": "1.201",
      "totalProfitRate": -0.045,
      "estimatedStopLossPct": -0.06
    }
  },
  {
    "sceneCode": "G1-10",
    "securityCode": "515050",
    "fieldsMap": {
      "closeWinRate": 0.68,
      "closedProfitSignalCount": 15,
      "totalProductReturnRate": 0.058,
      "signalDirection": "1",
      "followAmount": "42000",
      "followType": "partial",
      "followTime": "2026-06-12T09:30:00+08:00",
      "buyPrice": 1.385,
      "stopLossPrice": 1.298,
      "profitRate": -0.038,
      "Last": "1.332",
      "totalProfitRate": -0.038,
      "estimatedStopLossPct": -0.063
    }
  },
  {
    "sceneCode": "G2-02",
    "securityCode": "600036",
    "fieldsMap": {
      "closeWinRate": 0.61,
      "closedProfitSignalCount": 10,
      "totalProductReturnRate": 0.035,
      "signalDirection": "2",
      "followAmount": "80000",
      "followType": "full",
      "followTime": "2026-04-10T09:30:00+08:00",
      "negativeAnnouncement": "公司近期收到监管问询函，涉及关联交易披露事项。",
      "signalContent": "银行板块估值处于历史低位，招商银行作为龙头标的具备配置价值。"
    }
  },
  {
    "sceneCode": "G2-03",
    "securityCode": "601318",
    "fieldsMap": {
      "closeWinRate": 0.63,
      "closedProfitSignalCount": 11,
      "totalProductReturnRate": 0.038,
      "signalDirection": "2",
      "followAmount": "60000",
      "followType": "full",
      "followTime": "2026-04-25T09:30:00+08:00",
      "Last": "48.35"
    }
  },
  {
    "sceneCode": "G2-04",
    "securityCode": "512800",
    "fieldsMap": {
      "closeWinRate": 0.65,
      "closedProfitSignalCount": 13,
      "totalProductReturnRate": 0.045,
      "signalDirection": "2",
      "followAmount": "50000",
      "followType": "full",
      "followTime": "2026-05-05T09:30:00+08:00",
      "thsConceptCode": "银行",
      "thsConceptName": "银行",
      "popularConcepts": "[{\"rankType\":\"4\",\"rank\":1,\"code\":\"GN6101.BK\",\"name\":\"兵装重组概念\"},{\"rankType\":\"4\",\"rank\":2,\"code\":\"GN0462.BK\",\"name\":\"创新药\"},{\"rankType\":\"4\",\"rank\":3,\"code\":\"GN6108.BK\",\"name\":\"AI应用\"},{\"rankType\":\"4\",\"rank\":5,\"code\":\"GN0274.BK\",\"name\":\"PCB概念\"},{\"rankType\":\"4\",\"rank\":6,\"code\":\"GN0482.BK\",\"name\":\"共封装光学(CPO)\"},{\"rankType\":\"4\",\"rank\":7,\"code\":\"GN0201.BK\",\"name\":\"猪肉\"},{\"rankType\":\"4\",\"rank\":8,\"code\":\"GN0293.BK\",\"name\":\"CRO概念\"},{\"rankType\":\"4\",\"rank\":9,\"code\":\"GN0491.BK\",\"name\":\"存储芯片\"},{\"rankType\":\"4\",\"rank\":10,\"code\":\"GN0350.BK\",\"name\":\"商业航天\"},{\"rankType\":\"4\",\"rank\":11,\"code\":\"GN0038.BK\",\"name\":\"黄金概念\"},{\"rankType\":\"4\",\"rank\":12,\"code\":\"GN0488.BK\",\"name\":\"算力租赁\"},{\"rankType\":\"4\",\"rank\":13,\"code\":\"GN0538.BK\",\"name\":\"人形机器人\"},{\"rankType\":\"4\",\"rank\":14,\"code\":\"GN0286.BK\",\"name\":\"乳业\"},{\"rankType\":\"4\",\"rank\":15,\"code\":\"GN0447.BK\",\"name\":\"机器人概念\"},{\"rankType\":\"4\",\"rank\":16,\"code\":\"GN0282.BK\",\"name\":\"养鸡\"},{\"rankType\":\"4\",\"rank\":17,\"code\":\"GN0290.BK\",\"name\":\"白酒概念\"},{\"rankType\":\"4\",\"rank\":18,\"code\":\"GN0161.BK\",\"name\":\"小金属概念\"},{\"rankType\":\"4\",\"rank\":19,\"code\":\"GN0001.BK\",\"name\":\"军工\"},{\"rankType\":\"4\",\"rank\":20,\"code\":\"GN6084.BK\",\"name\":\"光纤概念\"}]"
    }
  },
  {
    "sceneCode": "G3-04",
    "securityCode": "512690",
    "fieldsMap": {
      "closeWinRate": 0.73,
      "closedProfitSignalCount": 17,
      "totalProductReturnRate": 0.065,
      "signalDirection": "1",
      "followAmount": "35000",
      "followType": "full",
      "followTime": "2026-05-15T09:30:00+08:00",
      "buyPrice": 0.912,
      "takeProfitPrice": 0.985,
      "profitRate": 0.082,
      "costPrice": 0.925,
      "totalProfitRate": 0.068,
      "thsConceptCode": "白酒",
      "thsConceptName": "食品饮料"
    }
  },
  {
    "sceneCode": "G4-03",
    "securityCode": "512000",
    "fieldsMap": {
      "signalDirection": "1",
      "buyPrice": 1.025,
      "signalContent": "券商板块受益于资本市场改革深化，估值修复空间较大。",
      "closeWinRate": 0.69,
      "closedProfitSignalCount": 13,
      "openDate": "2024-08-15",
      "saleDate": "2024-09-20",
      "profitRate": 0.075,
      "thsConceptCode": "券商",
      "thsConceptName": "证券",
      "serviceDescAI": "AI投顾服务基于量化模型和大数据分析，为客户提供个股信号推送服务。",
      "serviceDescAIPlus": "AI+投顾服务在AI投顾信号基础上，引入专属投顾一对一跟踪服务。"
    }
  },
  {
    "sceneCode": "G3-05",
    "securityCode": "159925",
    "fieldsMap": {
      "closeWinRate": 0.75,
      "closedProfitSignalCount": 19,
      "totalProductReturnRate": 0.078,
      "signalDirection": "1",
      "followAmount": "45000",
      "followType": "full",
      "followTime": "2026-05-25T09:30:00+08:00",
      "buyPrice": 1.128,
      "takeProfitPrice": 1.215,
      "profitRate": 0.077,
      "costPrice": 1.135,
      "totalProfitRate": 0.063,
      "thsConceptCode": "创业板",
      "thsConceptName": "创业板"
    }
  },
  {
    "sceneCode": "G3-06",
    "securityCode": "512480",
    "fieldsMap": {
      "closeWinRate": 0.76,
      "closedProfitSignalCount": 20,
      "totalProductReturnRate": 0.082,
      "signalDirection": "1",
      "followAmount": "38000",
      "followType": "full",
      "followTime": "2026-05-28T09:30:00+08:00",
      "buyPrice": 1.532,
      "takeProfitPrice": 1.658,
      "profitRate": 0.082,
      "costPrice": 1.548,
      "totalProfitRate": 0.068,
      "thsConceptCode": "半导体",
      "thsConceptName": "半导体"
    }
  }
]

  window.MOCK_DB["default-scripts.json"] = [
  {
    "signalType": "loss_unstopped",
    "content": "您好！注意到您近期跟随的信号出现了阶段性回撤，市场短期波动属于正常现象。建议您结合自身风险承受能力，重新评估当前持仓：若已跌破止损位，可考虑按纪律止损离场，控制风险；若仍在观察区间，也可保持关注，我们会持续为您跟踪信号变化，第一时间同步动向。有任何疑问欢迎随时联系我～"
  },
  {
    "signalType": "loss_stopped",
    "content": "您好！您近期有一笔跟投已按纪律完成止损离场，短期波动难免，及时止损也是控制风险、保护本金的重要一步。市场后续仍会有新的信号机会，建议您先保持观望，我们会持续为您筛选更稳健的跟投标的，有合适机会第一时间同步给您～"
  },
  {
    "signalType": "profit_done",
    "content": "您好！恭喜您，近期跟随的信号已实现不错的盈利表现，感谢您对我们服务的信任。建议您结合个人资金规划，考虑分批锁定部分收益，或继续保持关注以捕捉后续机会。如果您对当前持仓比例或后续操作有任何想法，欢迎随时和我聊聊，我可以帮您进一步分析～"
  },
  {
    "signalType": "unsigned",
    "content": "您好！最近市场上出现了几个值得关注的投资机会信号，表现比较稳健，很适合作为资产配置的补充。看您目前还未开通相关跟投服务，方便的话我可以先给您简单介绍一下产品逻辑和风险特征，您感兴趣的话我们可以约个时间详细聊聊～"
  }
]

})()
