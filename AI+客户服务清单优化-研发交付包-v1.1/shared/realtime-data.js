/**
 * realtime-data.js — 实时数据字段映射（场景化 KV 数据网格）
 * 完整转译自原项目 src/features/ai-service-list/utils/realTimeData.ts：
 * FIELD_CONFIG（字段元数据）+ SCENE_FIELD_LAYOUT（21 场景布局）+ mapFieldsToKeyData。
 * 页面通过 window.RealtimeData.getSceneLayout / mapFieldsToKeyData 调用。
 */
(function () {

  /** fieldsMap 字段名 → 显示元数据（label / format / colored / multiline） */
  var FIELD_CONFIG = {
    // ---- 基线字段（G1-01） ----
    closeWinRate: { label: '近一月闭环信号胜率', format: 'percent' },
    closedProfitSignalCount: { label: '近一月闭环盈利信号数', format: 'count' },
    totalProductReturnRate: { label: '近一月平均闭环收益率', format: 'percent', colored: true },
    signalDirection: { label: '信号方向', format: 'direction' },
    followAmount: { label: '跟单金额', format: 'text' },
    followType: { label: '跟单类型', format: 'text' },
    followTime: { label: '跟单时间', format: 'text' },
    // ---- G1-05 / G1-06 追加 ----
    thsConceptCode: { label: '标的所属概念代码', format: 'text' },
    thsConceptName: { label: '标的所属概念', format: 'text' },
    popularConcepts: { label: '当前热门概念', format: 'conceptList' },
    // ---- G1-07 追加 ----
    signalTime: { label: '信号卖出提示时间', format: 'text' },
    sellPrice: { label: '信号卖出提示价格', format: 'price' },
    profitRate: { label: '信号闭环收益率', format: 'percent', colored: true },
    totalProfitRate: { label: '累计跟单盈亏率', format: 'percent', colored: true },
    totalProfit: { label: '持仓盈亏额', format: 'amount', colored: true },
    // ---- G1-08 追加 ----
    closeProfitRate: { label: '客户实际卖出收益率', format: 'percent', colored: true },
    closeAvgPrice: { label: '客户清仓均价', format: 'price' },
    floatingProfit: { label: '持仓盈亏额', format: 'amount', colored: true },
    closeProfit: { label: '清仓盈亏额', format: 'amount', colored: true },
    entrustPrice: { label: '委托价格', format: 'price' },
    // ---- G1-09 / G1-10 追加 ----
    buyPrice: { label: '信号买入提示价格', format: 'price' },
    stopLossPrice: { label: '信号止损价', format: 'price' },
    Last: { label: '最新价', format: 'price' },
    estimatedStopLossPct: { label: '理论止损比例', format: 'percent', colored: true },
    // ---- G2-02 追加 ----
    negativeAnnouncement: { label: '负面公告', format: 'text', multiline: true },
    signalContent: { label: '推荐理由', format: 'text', multiline: true },
    // ---- G3-01 追加 ----
    takeProfitPrice: { label: '信号止盈价', format: 'price' },
    costPrice: { label: '跟随成本价', format: 'price' },
    // ---- G4-01 ----
    openDate: { label: '最大收益开仓日期', format: 'text' },
    saleDate: { label: '最大收益卖出日期', format: 'text' },
    serviceDescAI: { label: 'AI投顾服务介绍', format: 'text', multiline: true },
    serviceDescAIPlus: { label: 'AI+投顾服务介绍', format: 'text', multiline: true },
  }

  // ==================== 场景字段集合（九种字段集） ====================

  /** 基线字段块（G1/G2/G3 用，近一月口径） */
  var BASELINE_LAST_MONTH = [
    { key: 'signalDirection', label: '信号方向', description: '买入/卖出' },
    { key: 'followAmount', label: '跟单金额', description: '本次跟单金额（多次跟单取仓位重的一笔）' },
    { key: 'followType', label: '跟单类型', description: '手动跟随/自动跟随' },
    { key: 'followTime', label: '跟单时间', description: '本次跟单时间' },
    { key: 'buyPrice', label: '信号买入提示价格', description: '当前信号维度的信号买入提示价格' },
    { key: 'sellPrice', label: '信号卖出提示价格', description: '当前信号维度的信号卖出提示价格' },
    { key: 'profitRate', label: '信号盈亏率', description: '当前信号维度的信号盈亏率' },
    { key: 'thsConceptCode', label: '标的所属概念代码', description: '概念代码' },
    { key: 'thsConceptName', label: '标的所属概念', description: '概念名称' },
    { key: 'closeWinRate', label: '近一月信号胜率' },
    { key: 'closedProfitSignalCount', label: '近一月信号数量' },
    { key: 'totalProductReturnRate', label: '近一月信号累积收益率' },
  ]

  /** 概念字段块（G1-05/06、G2-04 用） */
  var CONCEPT_FIELDS = [
    { key: 'signalDirection', label: '信号方向', description: '买入/卖出' },
    { key: 'followAmount', label: '跟单金额', description: '本次跟单金额（多次跟单取仓位重的一笔）' },
    { key: 'followType', label: '跟单类型', description: '手动跟随/自动跟随' },
    { key: 'followTime', label: '跟单时间', description: '本次跟单时间' },
    { key: 'buyPrice', label: '信号买入提示价格', description: '当前信号维度的信号买入提示价格' },
    { key: 'sellPrice', label: '信号卖出提示价格', description: '当前信号维度的信号卖出提示价格' },
    { key: 'profitRate', label: '信号盈亏率', description: '当前信号维度的信号盈亏率' },
    { key: 'thsConceptCode', label: '标的所属概念代码', description: '概念代码' },
    { key: 'thsConceptName', label: '标的所属概念', description: '概念名称' },
    { key: 'popularConcepts', label: '当前热门概念', description: '同花顺前20' },
    { key: 'closeWinRate', label: '近一月信号胜率' },
    { key: 'closedProfitSignalCount', label: '近一月信号数量' },
    { key: 'totalProductReturnRate', label: '近一月信号累积收益率' },
  ]

  /** G1-07 追加（没有跟卖） */
  var G1_07_EXTRA = [
    { key: 'signalDirection', label: '信号方向', description: '买入/卖出' },
    { key: 'followAmount', label: '跟单金额', description: '本次跟单金额（多次跟单取仓位重的一笔）' },
    { key: 'followType', label: '跟单类型', description: '手动跟随/自动跟随' },
    { key: 'followTime', label: '跟单时间', description: '本次跟单时间' },
    { key: 'buyPrice', label: '信号买入提示价格', description: '当前信号维度的信号买入提示价格' },
    { key: 'sellPrice', label: '信号卖出提示价格', description: '当前信号维度的信号卖出提示价格' },
    { key: 'profitRate', label: '信号盈亏率', description: '当前信号维度的信号盈亏率' },
    { key: 'thsConceptCode', label: '标的所属概念代码', description: '概念代码' },
    { key: 'thsConceptName', label: '标的所属概念', description: '概念名称' },
    { key: 'signalTime', label: '信号卖出提示时间', description: '当前信号维度的信号卖出提示时间' },
    { key: 'totalProfit', label: '持仓盈亏额', description: '客户当前持仓盈亏额（实时）' },
    { key: 'closeWinRate', label: '近一月信号胜率' },
    { key: 'closedProfitSignalCount', label: '近一月信号数量' },
    { key: 'totalProductReturnRate', label: '近一月信号累积收益率' },
  ]

  /** G1-08 追加（卖早了） */
  var G1_08_EXTRA = [
    { key: 'signalDirection', label: '信号方向', description: '买入/卖出' },
    { key: 'followAmount', label: '跟单金额', description: '本次跟单金额（多次跟单取仓位重的一笔）' },
    { key: 'followType', label: '跟单类型', description: '手动跟随/自动跟随' },
    { key: 'followTime', label: '跟单时间', description: '本次跟单时间' },
    { key: 'buyPrice', label: '信号买入提示价格', description: '当前信号维度的信号买入提示价格' },
    { key: 'sellPrice', label: '信号卖出提示价格', description: '当前信号维度的信号卖出提示价格' },
    { key: 'profitRate', label: '信号盈亏率', description: '当前信号维度的信号盈亏率' },
    { key: 'thsConceptCode', label: '标的所属概念代码', description: '概念代码' },
    { key: 'thsConceptName', label: '标的所属概念', description: '概念名称' },
    { key: 'closeAvgPrice', label: '客户清仓均价', description: '多次清仓卖出取均值' },
    {
      key: 'closeProfitRate',
      label: '客户实际卖出收益率',
      description: '用清仓盈亏额计算（跟投1万股实际卖出5千股，只算5千股清仓的）',
    },
    { key: 'Last', label: '当前标的最新价', description: '实时' },
    { key: 'profitRate', label: '信号当前收益率' },
    { key: 'stopLossPrice', label: '信号止损价' },
    {
      key: 'estimatedStopLossPct',
      label: '理论止损比例',
      description:
        '根据客户实际跟买的价格计算，不根据策略信号的统计价格计算；理论止损比例=（信号止损价格-实际跟买价格）➗实际跟买价格*100】',
    },
    { key: 'closeWinRate', label: '近一月信号胜率' },
    { key: 'closedProfitSignalCount', label: '近一月信号数量' },
    { key: 'totalProductReturnRate', label: '近一月信号累积收益率' },
  ]

  /** G1-09/10 追加（浮亏≤7% 正常调整） */
  var G1_09_EXTRA = [
    { key: 'signalDirection', label: '信号方向', description: '买入/卖出' },
    { key: 'followAmount', label: '跟单金额', description: '本次跟单金额（多次跟单取仓位重的一笔）' },
    { key: 'followType', label: '跟单类型', description: '手动跟随/自动跟随' },
    { key: 'followTime', label: '跟单时间', description: '本次跟单时间' },
    { key: 'buyPrice', label: '信号买入提示价格', description: '当前信号维度的信号买入提示价格' },
    { key: 'sellPrice', label: '信号卖出提示价格', description: '当前信号维度的信号卖出提示价格' },
    { key: 'profitRate', label: '信号盈亏率', description: '当前信号维度的信号盈亏率' },
    { key: 'costPrice', label: '累计跟单成本价', description: '累计跟单金额/跟单份额' },
    {
      key: 'totalProfitRate',
      label: '累积跟单盈亏率',
      description: '信号组维度多笔交易综合盈亏率：跟单浮盈金额/跟投总金额',
    },
    { key: 'thsConceptCode', label: '标的所属概念代码', description: '概念代码' },
    { key: 'thsConceptName', label: '标的所属概念', description: '概念名称' },
    { key: 'Last', label: '当前标的最新价', description: '实时' },
    { key: 'stopLossPrice', label: '信号止损价' },
    { key: 'closeWinRate', label: '近一月信号胜率' },
    { key: 'closedProfitSignalCount', label: '近一月信号数量' },
    { key: 'totalProductReturnRate', label: '近一月信号累积收益率' },
  ]

  /** G2-02 追加 */
  var G2_02_EXTRA = [
    { key: 'negativeAnnouncement', label: '标的相关负面公告' },
    { key: 'signalContent', label: 'AI选好股推荐理由' },
    { key: 'signalDirection', label: '信号方向', description: '买入/卖出' },
    { key: 'followAmount', label: '跟单金额', description: '本次跟单金额（多次跟单取仓位重的一笔）' },
    { key: 'followType', label: '跟单类型', description: '手动跟随/自动跟随' },
    { key: 'followTime', label: '跟单时间', description: '本次跟单时间' },
    { key: 'buyPrice', label: '信号买入提示价格', description: '当前信号维度的信号买入提示价格' },
    { key: 'sellPrice', label: '信号卖出提示价格', description: '当前信号维度的信号卖出提示价格' },
    { key: 'profitRate', label: '信号盈亏率', description: '当前信号维度的信号盈亏率' },
    { key: 'thsConceptCode', label: '标的所属概念代码', description: '概念代码' },
    { key: 'thsConceptName', label: '标的所属概念', description: '概念名称' },
    { key: 'closeWinRate', label: '近一月信号胜率' },
    { key: 'closedProfitSignalCount', label: '近一月信号数量' },
    { key: 'totalProductReturnRate', label: '近一月信号累积收益率' },
  ]

  /** G2-04 追加 */
  var G2_04_EXTRA = [
    { key: 'popularConcepts', label: '当前热门概念', description: '同花顺前20' },
    { key: 'signalDirection', label: '信号方向', description: '买入/卖出' },
    { key: 'followAmount', label: '跟单金额', description: '本次跟单金额（多次跟单取仓位重的一笔）' },
    { key: 'followType', label: '跟单类型', description: '手动跟随/自动跟随' },
    { key: 'followTime', label: '跟单时间', description: '本次跟单时间' },
    { key: 'buyPrice', label: '信号买入提示价格', description: '当前信号维度的信号买入提示价格' },
    { key: 'sellPrice', label: '信号卖出提示价格', description: '当前信号维度的信号卖出提示价格' },
    { key: 'profitRate', label: '信号盈亏率', description: '当前信号维度的信号盈亏率' },
    { key: 'thsConceptCode', label: '标的所属概念代码', description: '概念代码' },
    { key: 'thsConceptName', label: '标的所属概念', description: '概念名称' },
    { key: 'closeWinRate', label: '近一月信号胜率' },
    { key: 'closedProfitSignalCount', label: '近一月信号数量' },
    { key: 'totalProductReturnRate', label: '近一月信号累积收益率' },
  ]

  /** G3-01~06 追加 */
  var G3_EXTRA = [
    { key: 'signalDirection', label: '信号方向', description: '买入/卖出' },
    { key: 'followAmount', label: '跟单金额', description: '本次跟单金额（多次跟单取仓位重的一笔）' },
    { key: 'followType', label: '跟单类型', description: '手动跟随/自动跟随' },
    { key: 'followTime', label: '跟单时间', description: '本次跟单时间' },
    { key: 'buyPrice', label: '信号买入提示价格', description: '当前信号维度的信号买入提示价格' },
    { key: 'sellPrice', label: '信号卖出提示价格', description: '当前信号维度的信号卖出提示价格' },
    { key: 'takeProfitPrice', label: '信号止盈价', description: '当前信号维度的信号止盈价格' },
    { key: 'profitRate', label: '信号盈亏率', description: '当前信号维度的信号盈亏率' },
    { key: 'thsConceptCode', label: '标的所属概念代码', description: '概念代码' },
    { key: 'thsConceptName', label: '标的所属概念', description: '概念名称' },
    { key: 'closeWinRate', label: '近一月信号胜率' },
    { key: 'closedProfitSignalCount', label: '近一月信号数量' },
    { key: 'totalProductReturnRate', label: '近一月信号累积收益率' },
  ]

  /** G4-01~03 独立字段集（近一年口径） */
  var G4_FIELDS = [
    { key: 'buyPrice', label: '持仓命中信号买入提示价格', description: '当前持仓命中信号的信号买入提示价格' },
    { key: 'sellPrice', label: '持仓命中信号卖出提示价格', description: '当前持仓命中信号的信号卖出提示价格' },
    { key: 'signalContent', label: 'AI选好股推荐理由' },
    { key: 'closeWinRate', label: '该标的近一年闭环信号胜率' },
    { key: 'closedProfitSignalCount', label: '该标的近一年信号次数' },
    { key: 'openDate', label: '近一年最大收益率信号开仓日期' },
    { key: 'saleDate', label: '近一年最大收益率信号卖出日期' },
    { key: 'profitRate', label: '近一年最大收益率信号收益率' },
    { key: 'thsConceptCode', label: '标的所属概念代码', description: '概念代码' },
    { key: 'thsConceptName', label: '标的所属概念', description: '概念名称' },
  ]

  /** 场景布局：场景级标题/描述/提示 + 字段映射集合（21 个场景） */
  var SCENE_FIELD_LAYOUT = {
    'G1-01': {
      title: '客户跟随亏损且信号未止损',
      description: 'G1-01：板块下跌异动 + 仓位不重（<10%）',
      tooltip: '1、客户签约AI+，标的所属板块下跌异动 2、客户跟投亏损且信号未止损，跟随仓位比例<10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日）',
      mapping: BASELINE_LAST_MONTH,
    },
    'G1-02': {
      title: '客户跟随亏损且信号未止损',
      description: 'G1-02：板块下跌异动 + 仓位较重（≥10%）',
      tooltip: '1、客户签约AI+，标的所属板块下跌异动 2、客户跟投亏损且信号未止损，跟随仓位比例≥10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日）',
      mapping: BASELINE_LAST_MONTH,
    },
    'G1-03': {
      title: '客户跟随亏损且信号未止损',
      description: 'G1-03：无板块异动 → 行情原因 + 仓位不重（<10%）',
      tooltip: '1、客户签约AI+，板块未触发下跌异动 2、客户跟投亏损且信号未止损，跟投亏损≥10%，跟随仓位比例<10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日） 4、信号所属板块下跌且上证指数下跌；',
      mapping: BASELINE_LAST_MONTH,
    },
    'G1-04': {
      title: '客户跟随亏损且信号未止损',
      description: 'G1-04：无板块异动 → 行情原因 + 仓位较重（≥10%）',
      tooltip: '1、客户签约AI+，板块未触发下跌异动 2、客户跟投亏损且信号未止损，跟投亏损≥10%，跟随仓位比例≥10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日） 4、信号所属板块下跌且上证指数下跌；',
      mapping: BASELINE_LAST_MONTH,
    },
    'G1-05': {
      title: '客户跟随亏损且信号未止损',
      description: 'G1-05：无板块异动 → 不在热点概念 + 仓位不重（<10%）',
      tooltip: '1、客户签约AI+，板块未触发下跌异动 2、客户跟投亏损且信号未止损，跟投亏损≥10%，跟随仓位比例<10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日）4、信号所属板块不在热点概念；（热点事件解读口径/AI+风口概念）',
      mapping: CONCEPT_FIELDS,
    },
    'G1-06': {
      title: '客户跟随亏损且信号未止损',
      description: 'G1-06：无板块异动 → 不在热点概念 + 仓位较重（≥10%）',
      tooltip: '1、客户签约AI+，板块未触发下跌异动 2、客户跟投亏损且信号未止损，跟投亏损≥10%，跟随仓位比例≥10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日） 4、信号所属板块不在热点概念；（热点事件解读口径/AI+风口概念）',
      mapping: CONCEPT_FIELDS,
    },
    'G1-07': {
      title: '客户跟随亏损且信号盈利闭环',
      description: 'G1-07：无板块异动：没有跟卖（信号盈利闭环，客户未跟卖）',
      tooltip: '1、客户签约AI+，板块未触发下跌异动 2、客户跟投亏损，信号盈利闭环，客户未跟卖；跟投亏损≥10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日）',
      mapping: G1_07_EXTRA,
    },
    'G1-08': {
      title: '客户跟随亏损且信号未止损',
      description: 'G1-08：无板块异动：卖早了（客户亏损清仓，信号未闭环）',
      tooltip: '1、客户签约AI+，板块未触发下跌异动 2、客户跟投亏损且信号未止损，跟投亏损≥10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日） 4、客户亏损清仓，信号未闭环',
      mapping: G1_08_EXTRA,
    },
    'G1-09': {
      title: '客户跟随亏损且信号未止损',
      description: 'G1-09：无板块异动：正常调整+ 仓位不重（<10%）',
      tooltip: '1、客户签约AI+，板块未触发下跌异动 2、客户投随亏损且信号未止损，跟投亏损≥10%，信号浮亏幅度小于7%；跟随仓位比例<10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日）',
      mapping: G1_09_EXTRA,
    },
    'G1-10': {
      title: '客户跟随亏损且信号未止损',
      description: 'G1-10：无板块异动：正常调整 + 仓位较重（>= 10%）',
      tooltip: '1、客户签约AI+，板块未触发下跌异动 2、客户跟投亏损且信号未止损，跟投亏损≥10%，信号浮亏幅度小于7%；跟随仓位比例≥10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日）',
      mapping: G1_09_EXTRA,
    },
    'G2-01': {
      title: '客户跟投亏损且信号已止损',
      description: 'G2-01：板块出现异动',
      tooltip: '1、客户签约AI+，标的所属板块下跌异动 2、客户投随亏损且信号已止损，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日）',
      mapping: BASELINE_LAST_MONTH,
    },
    'G2-02': {
      title: '客户跟投亏损且信号已止损',
      description: 'G2-02：板块无异动：推荐逻辑变动',
      tooltip: '1、客户签约AI+，标的所属板块无异动 2、客户投随亏损且信号已止损，跟投亏损≥10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日） 4、抓取智能中枢公告，判断是否出现与标的相关的负面公告，且影响原推荐逻辑',
      mapping: G2_02_EXTRA,
    },
    'G2-03': {
      title: '客户跟投亏损且信号已止损',
      description: 'G2-03：板块无异动：行情原因',
      tooltip: '1、客户签约AI+，标的所属板块无异动 2、客户投随亏损且信号已止损，跟投亏损≥10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日） 4、信号所属板块/概念指数<0或上证指数<0（若下跌超过1%，进一步抓取市场下跌相关资讯）',
      mapping: BASELINE_LAST_MONTH,
    },
    'G2-04': {
      title: '客户跟投亏损且信号已止损',
      description: 'G2-04：板块无异动：不在热点概念',
      tooltip: '1、客户签约AI+，标的所属板块无异动 2、客户投随亏损且信号已止损，跟投亏损≥10%，跟随持仓的标的整体亏损 3、跟单数据取近20自然日（截止到T-1日） 4、信号标的所属概念不属于当前风口概念板块（AI+风口概念/热点事件解读口径）',
      mapping: G2_04_EXTRA,
    },
    'G3-01': {
      title: '客户跟投盈利且信号盈利了结',
      description: 'G3-01：板块触发向上异动 + 仓位较重（≥10%）',
      tooltip: '1、客户签约AI+，标的所属板块触发向上异动 2、客户跟投盈利且信号盈利了结，跟随持仓的标的整体盈利 3、信号T-1日盈利闭环；',
      mapping: G3_EXTRA,
    },
    'G3-02': {
      title: '客户跟投盈利且信号盈利了结',
      description: 'G3-02：板块触发向上异动 + 仓位不重且属于风口板块',
      tooltip: '1、客户签约AI+，标的所属板块触发向上异动 2、客户跟投盈利且信号盈利了结，跟随仓位比例<10%，跟随持仓的标的整体盈利 3、信号T-1日盈利闭环； 4、信号所属板块/概念属于当前风口概念板块',
      mapping: G3_EXTRA,
    },
    'G3-03': {
      title: '客户跟投盈利且信号盈利了结',
      description: 'G3-03：板块触发向上异动 + 仓位不重且非风口板块',
      tooltip: '1、客户签约AI+，标的所属板块触发向上异动 2、客户跟投盈利且信号盈利了结，跟随仓位比例<10%，跟随持仓的标的整体盈利 3、信号T-1日盈利闭环； 4、信号所属板块/概念不属于当前风口概念板块',
      mapping: G3_EXTRA,
    },
    'G3-04': {
      title: '客户跟投盈利且信号盈利了结',
      description: 'G3-04：板块未触发向上异动 →  仓位较重（≥10%）',
      tooltip: '1、客户签约AI+，标的所属板块未触发向上异动 2、客户跟投盈利且信号盈利了结，跟随仓位比例≥10%，跟随持仓的标的整体盈利 3、信号T-1日盈利闭环；',
      mapping: G3_EXTRA,
    },
    'G3-05': {
      title: '客户跟投盈利且信号盈利了结',
      description: 'G3-05：板块未触发向上异动 → 仓位不重且风口板块',
      tooltip: '1、客户签约AI+，标的所属板块未触发向上异动 2、客户跟投盈利且信号盈利了结，跟随仓位比例<10%，跟随持仓的标的整体盈利 3、信号T-1日盈利闭环； 4、信号所属板块/概念属于当前风口概念板块',
      mapping: G3_EXTRA,
    },
    'G3-06': {
      title: '客户跟投盈利且信号盈利了结',
      description: 'G3-06：板块未触发向上异动 → 仓位不重且非风口板块',
      tooltip: '1、客户签约AI+，标的所属板块未触发向上异动 2、客户跟投盈利且信号盈利了结，跟随仓位比例<10%，跟随持仓的标的整体盈利 3、信号T-1日盈利闭环； 4、信号所属板块/概念不属于当前风口概念板块',
      mapping: G3_EXTRA,
    },
    'G4-01': {
      title: '客户未签约AI+，持仓出现AI信号',
      description: 'G4-01：持仓标的属于风口概念',
      tooltip: '1、客户未签约AI+ 2、上周AI投顾盈利信号命中客户持仓；（截止周五收盘） 3、持仓标的所属概念属于当前风口概念板块或出现在热门概念列表中',
      mapping: G4_FIELDS,
    },
    'G4-02': {
      title: '客户未签约AI+，持仓出现AI信号',
      description: 'G4-02：持仓标的属于热点事件涉及板块',
      tooltip: '1、客户未签约AI+ 2、上周AI投顾盈利信号命中客户持仓；（截止周五收盘） 3、持仓标的所属概念属于热点事件解读SKILL覆盖的行业/板块，或该行业/板块当前存在热点事件或板块异动。',
      mapping: G4_FIELDS,
    },
    'G4-03': {
      title: '客户未签约AI+，持仓出现AI信号',
      description: 'G4-03：未命中风口概念或热点事件',
      tooltip: '1、客户未签约AI+ 2、上周AI投顾盈利信号命中客户持仓；（截止周五收盘） 3、持仓标的不属于当前风口概念，且未命中热点事件解读涉及的行业板块',
      mapping: G4_FIELDS,
    },
  }

  // ==================== 格式化函数 ====================

  function formatDirection(val) {
    var s = String(val)
    if (s === '1') return '买入'
    if (s === '2') return '卖出'
    if (s === '0') return '不变'
    return s
  }

  function formatPercent(val) {
    var num = Number(val)
    if (isNaN(num)) return String(val)
    return (num * 100).toFixed(2) + '%'
  }

  function formatPrice(val) {
    var num = Number(val)
    if (isNaN(num)) return String(val)
    return num.toFixed(2) + '元'
  }

  function formatAmount(val) {
    var num = Number(val)
    if (isNaN(num)) return String(val)
    return num.toLocaleString('zh-CN') + '元'
  }

  function formatCount(val) {
    var num = Number(val)
    if (isNaN(num)) return String(val)
    return num + '个'
  }

  /** 解析 popularConcepts JSON 字符串，按 rank 升序 */
  function parseConceptList(raw) {
    if (typeof raw !== 'string') return []
    try {
      var parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter(function (item) { return typeof item === 'object' && item !== null && 'name' in item })
        .map(function (item) {
          return {
            rank: Number(item.rank) || 0,
            code: String(item.code || ''),
            name: String(item.name || ''),
          }
        })
        .sort(function (a, b) { return a.rank - b.rank })
    } catch (e) {
      return []
    }
  }

  /** 根据数值正负判断盈亏色调：>0 红（盈利）、<0 绿（亏损） */
  function getTone(val) {
    var num = Number(val)
    if (isNaN(num)) return undefined
    if (num > 0) return { cls: 'red', tone: 'profit-tone' }
    if (num < 0) return { cls: 'green', tone: 'loss-tone' }
    return undefined
  }

  /** 构建单个 KeyDataItem（含格式化、着色、多行标记）；rawVal 为 null/undefined 返回 null */
  function buildItem(key, label, rawVal, description) {
    if (rawVal == null) return null
    var meta = FIELD_CONFIG[key]
    var item = { label: label, value: '', description: description }

    if (!meta) {
      item.value = String(rawVal)
      return item
    }

    switch (meta.format) {
      case 'percent': item.value = formatPercent(rawVal); break
      case 'price': item.value = formatPrice(rawVal); break
      case 'amount': item.value = formatAmount(rawVal); break
      case 'count': item.value = formatCount(rawVal); break
      case 'direction': item.value = formatDirection(rawVal); break
      case 'conceptList': {
        var concepts = parseConceptList(rawVal)
        item.conceptList = concepts
        item.value = concepts.slice(0, 3).map(function (c) { return c.rank + '.' + c.name }).join('  ')
        break
      }
      default: item.value = String(rawVal)
    }

    if (meta.colored) {
      var tone = getTone(rawVal)
      if (tone) { item.cls = tone.cls; item.tone = tone.tone }
    }
    if (meta.multiline) item.multiline = true

    return item
  }

  /**
   * 将 realTime/data 接口返回的 fieldsMap 转换为 KeyDataItem[] 渲染数据
   * 优先按 SCENE_FIELD_LAYOUT 声明的字段顺序与 label 输出；未知 sceneCode 兜底按 FIELD_CONFIG 顺序
   */
  function mapFieldsToKeyData(fieldsMap, sceneCode) {
    var layout = sceneCode ? (SCENE_FIELD_LAYOUT[sceneCode] || {}).mapping : undefined
    if (layout) {
      return layout
        .map(function (f) { return buildItem(f.key, f.label, fieldsMap[f.key], f.description) })
        .filter(function (item) { return item !== null })
    }
    return Object.keys(FIELD_CONFIG)
      .map(function (key) { return buildItem(key, FIELD_CONFIG[key].label, fieldsMap[key]) })
      .filter(function (item) { return item !== null })
  }

  window.RealtimeData = {
    FIELD_CONFIG: FIELD_CONFIG,
    SCENE_FIELD_LAYOUT: SCENE_FIELD_LAYOUT,
    getSceneLayout: function (sceneCode) { return SCENE_FIELD_LAYOUT[sceneCode] },
    mapFieldsToKeyData: mapFieldsToKeyData,
    parseConceptList: parseConceptList,
  }
})()
