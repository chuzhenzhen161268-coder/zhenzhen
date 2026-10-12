/**
 * mock-api.js — AI+客户服务清单 Demo 模拟接口层
 * 还原原项目 src/features/ai-service-list/api.ts 的 8 个模块接口 + services/call 横切接口，
 * 数据源为 mock-data/*.json（按领域模型拆分），统一 200ms 延迟模拟网络。
 *
 * 数据加载双轨：优先读取 window.MOCK_DB（由 mock-data.js 以 <script> 方式内联，
 * file:// 协议直接双击打开可用）；未引入时回退 fetch mock-data/*.json（HTTP 环境）。
 * 页面引入顺序：<script src="../mock-data.js"></script> → <script src="../mock-api.js"></script>
 *
 * 接口与源码映射：
 *   getPageData(taskId)        → GET  /api/service/list            （api.ts getPageData）
 *   getClientTasks(clientId)   → POST /callout/task/list            （api.ts getClientTasks）
 *   getMarketData(req)         → POST realTime/data                 （api.ts getMarketData）
 *   getContacts(clientId)      → POST /callout/task/selectContactsList（services/call/api.ts selectContactsList）
 *   completeService(req)       → POST serviceLog-add                （api.ts completeService）
 *   submitTaskSummary(req)     → POST /callout/task/task-summary    （api.ts submitTaskSummary）
 *   saveSnapshot(req)          → POST snapshot-update               （api.ts saveSnapshot）
 *   massCheck(req)             → POST mass-check                    （api.ts massCheck）
 *   massWx(req)                → POST mass-wx                       （api.ts massWx）
 *   queryTelNo() / makeCall(req) / hangUp() → 恒生呼叫中心接口（services/call/api.ts）
 *
 * 边界状态注入（URL 参数 ?state=xxx，对应 PRD 附录 D 异常边界场景）：
 *   normal（缺省）正常数据
 *   empty            客户列表为空            → D2-03 暂无客户数据
 *   error            主接口 HTTP 500         → D2-01/D2-02 加载失败可重试
 *   403              业务码 1003 无权限      → D1-03 权限不足
 *   slow             3s 延迟                 → 骨架屏加载态
 *   no-wx            群发校验全部无企微关系   → D3-05 群发无可发送客户
 *   broadcast-done   全部客户今日已群发       → D3-06 重复群发拦截
 *   call-fail        外呼接口失败            → D5-01 拨号失败
 *
 * 快照持久化：saveSnapshot 将 serveStatus / wxBroadcastStatus / sceneScript 修改写入
 * localStorage（key: ai_service_list_demo_snapshot），getPageData 返回前合并，
 * 模拟原系统「快照落库 + 重新拉取 page-data」闭环。mockApi.resetSnapshots() 可重置。
 */
(function () {

  var LATENCY = 200
  var SLOW_LATENCY = 3000
  var SNAPSHOT_KEY = 'ai_service_list_demo_snapshot'
  var DATA_BASE = '../mock-data/'

  var stateMode = (function () {
    var m = new URLSearchParams(location.search).get('state')
    return m || 'normal'
  })()

  var cache = {} // JSON 数据缓存

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms) })
  }

  function netLatency() {
    return delay(stateMode === 'slow' ? SLOW_LATENCY : LATENCY)
  }

  /**
   * 加载 Mock 数据：优先内联数据源 window.MOCK_DB（mock-data.js 以 <script> 引入，
   * file:// 协议下可用），否则回退 fetch（HTTP 环境；file:// 下会被浏览器 CORS 拦截）
   */
  function fetchJson(name) {
    if (cache[name]) return Promise.resolve(cache[name])
    var inline = (window.MOCK_DB || {})[name]
    if (inline != null) {
      cache[name] = inline
      return Promise.resolve(inline)
    }
    return fetch(DATA_BASE + name)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.json()
      })
      .then(function (json) {
        cache[name] = json
        return json
      })
      .catch(function () {
        throw new Error(
          'Mock 数据加载失败（' + name + '）。' +
          '请确认页面已按顺序引入 mock-data.js 与 mock-api.js；' +
          '若仍失败，可通过本地 HTTP 服务器访问（如 node prd-demo-package/tools/serve.cjs）。',
        )
      })
  }

  /** 统一响应结构 { code, message, result }（对应 request.ts ApiResponse） */
  function ok(result) {
    return { code: 0, message: 'success', result: result }
  }

  function bizError(code, message) {
    var e = new Error(message)
    e.code = code
    return e
  }

  // ==================== 快照持久化 ====================

  function loadSnapshots() {
    try {
      return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '{}')
    } catch (e) {
      return {}
    }
  }

  function saveSnapshots(data) {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data))
  }

  /**
   * 将快照合并进 page-data（模拟后端 snapshot-update 落库后 page-data 返回最新值）
   * 快照结构（与 SnapshotSaveReq 契约一致）：
   * { [uuid]: { serveStatus?, serveTime?, wxBroadcastStatus?, wxBroadcastTime?, scripts?: { [securityCode]: sceneScript } } }
   */
  function applySnapshots(pageData) {
    var snapshots = loadSnapshots()
    pageData.customers.forEach(function (c) {
      var s = snapshots[c.uuid]
      if (!s) return
      if (s.serveStatus != null) { c.serveStatus = s.serveStatus; c.serveTime = s.serveTime }
      if (s.wxBroadcastStatus != null) {
        c.wxBroadcastStatus = s.wxBroadcastStatus
        c.wxBroadcastTime = s.wxBroadcastTime
      }
      if (s.scripts) {
        (c.securityList || []).forEach(function (sec) {
          if (s.scripts[sec.securityCode] != null) sec.sceneScript = s.scripts[sec.securityCode]
        })
      }
    })
    return pageData
  }

  /** 今日日期 YYYY-MM-DD / MM-DD / HH:MM（本地时间，对应 utils/format.ts） */
  function todayYMD() {
    var d = new Date()
    var p = function (n) { return (n < 10 ? '0' : '') + n }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }
  function todayMD() { return todayYMD().slice(5) }
  function nowHM() {
    var d = new Date()
    var p = function (n) { return (n < 10 ? '0' : '') + n }
    return p(d.getHours()) + ':' + p(d.getMinutes())
  }

  // ==================== 对外接口 ====================

  window.mockApi = {
    /** 当前注入的状态模式（页面据此展示边界说明条） */
    stateMode: stateMode,

    /** URL 中的任务码（对应原系统 /ai-service-list?taskId=xxx 入口） */
    taskId: new URLSearchParams(location.search).get('taskId') || '1749991200000123456',

    /**
     * GET /api/service/list — 页面主数据
     * @returns {Promise<PageDataResp>}
     */
    getPageData: function () {
      return netLatency().then(function () {
        if (stateMode === 'error') throw new Error('HTTP 500：服务端异常，请稍后重试')
        if (stateMode === '403') throw bizError(1003, '无权限操作该客户数据')
        // PageDataResp 契约：customers + customerPortraits + defaultScripts（群发预置话术）
        // demo 将 defaultScripts 按领域拆分至 default-scripts.json，此处合并回契约结构
        return Promise.all([fetchJson('page-data.json'), fetchJson('default-scripts.json')])
          .then(function (arr) {
          var data = arr[0]
          var result = JSON.parse(JSON.stringify(data))
          result.defaultScripts = arr[1]
          if (stateMode === 'empty') result.customers = []
          if (stateMode === 'broadcast-done') {
            result.customers.forEach(function (c) {
              c.wxBroadcastStatus = 1
              c.wxBroadcastTime = todayYMD() + ' 09:30'
            })
          }
          return applySnapshots(result)
        })
      }).then(function (result) { return ok(result) })
    },

    /**
     * POST /callout/task/list — 客户待办任务
     * @returns {Promise<ClientTasksResp>}
     */
    getClientTasks: function (clientId) {
      return netLatency().then(function () {
        return fetchJson('tasks.json')
      }).then(function (map) {
        var result = map[clientId] || { total: 0, list: [] }
        return ok(JSON.parse(JSON.stringify(result)))
      })
    },

    /**
     * POST realTime/data — 实时行情数据
     * @param {{ securityScenes: {securityCode: string, sceneCode: string}[] }} req
     * @returns {Promise<MarketDataResp>}
     */
    getMarketData: function (req) {
      return netLatency().then(function () {
        return fetchJson('market-data.json')
      }).then(function (all) {
        var scenes = (req && req.securityScenes) || []
        var result = all.filter(function (item) {
          return scenes.some(function (s) {
            return s.securityCode === item.securityCode && s.sceneCode === item.sceneCode
          })
        })
        return ok(JSON.parse(JSON.stringify(result)))
      })
    },

    /**
     * POST /callout/task/selectContactsList — 客户联系电话
     * @returns {Promise<IContactInfoResult>}
     */
    getContacts: function (clientId) {
      return netLatency().then(function () {
        return fetchJson('contacts.json')
      }).then(function (map) {
        var result = map[clientId] || { client_name: '', client_gender: '', list: [] }
        return ok(JSON.parse(JSON.stringify(result)))
      })
    },

    /**
     * POST serviceLog-add — 完成服务（新增服务日志，ISMP 渠道网关）
     * @param {{custType,custName,fundAccountOrSource,serviceDate,serviceType,content,source}} req
     */
    completeService: function (req) {
      return netLatency().then(function () {
        // 原系统成功返回 result=null（CompleteResp）
        return ok(null)
      })
    },

    /**
     * POST /callout/task/task-summary — 待处理任务小结（关联完结勾选任务）
     * @param {{account_id,account_type,callout_summary_comment,serviceType,service_record,call_list,multitask,list}} req
     */
    submitTaskSummary: function (req) {
      return netLatency().then(function () {
        return ok(null)
      })
    },

    /**
     * POST snapshot-update — 快照保存
     * @param {{taskId: string, customers: Array<{uuid, serveStatus?, serveTime?, wxBroadcastStatus?, wxBroadcastTime?, securityList?: Array<{securityCode, sceneScript}>}>}} req
     * @returns {Promise<SnapshotSaveResp>}
     */
    saveSnapshot: function (req) {
      return netLatency().then(function () {
        var snapshots = loadSnapshots()
        ;(req.customers || []).forEach(function (c) {
          var s = snapshots[c.uuid] || { scripts: {} }
          if (c.serveStatus != null) { s.serveStatus = c.serveStatus; s.serveTime = c.serveTime }
          if (c.wxBroadcastStatus != null) {
            s.wxBroadcastStatus = c.wxBroadcastStatus
            s.wxBroadcastTime = c.wxBroadcastTime
          }
          ;(c.securityList || []).forEach(function (sec) {
            if (sec.sceneScript != null) s.scripts[sec.securityCode] = sec.sceneScript
          })
          snapshots[c.uuid] = s
        })
        saveSnapshots(snapshots)
        return ok({
          taskId: req.taskId,
          updatedFields: Object.keys(snapshots),
          savedAt: new Date().toISOString(),
        })
      })
    },

    /**
     * POST mass-check — 企微群发第一步：客户企微关系校验
     * @param {{taskId, type, receivers: {uuid, clientId}[]}} req
     * @returns {Promise<MassCheckResp>} hasWxRelations / noWxRelations（thatDaySendFlag=今日已发）
     */
    massCheck: function (req) {
      return netLatency().then(function () {
        return fetchJson('page-data.json')
      }).then(function (pageData) {
        var snapshots = loadSnapshots()
        var receivers = req.receivers || []
        var hasWx = []
        var noWx = []
        if (stateMode === 'no-wx') {
          // 边界注入：全部接收人无企微关系（D3-05 群发无可发送客户）
          noWx = receivers.map(function (r) { return { externalUserId: 'wm_' + r.uuid } })
        } else {
          // 原 mock：所有客户均有企微关系；thatDaySendFlag 按合并快照后的今日群发状态判定
          receivers.forEach(function (r) {
            var snap = snapshots[r.uuid] || {}
            var sentToday = snap.wxBroadcastStatus === 1 &&
              String(snap.wxBroadcastTime || '').slice(0, 10) === todayYMD()
            hasWx.push({
              externalUserId: 'wm_' + r.uuid,
              user: 'advisor_001',
              adAccount: 'E001234',
              thatDaySendFlag: sentToday,
            })
          })
        }
        return ok({ hasWxRelations: hasWx, noWxRelations: noWx })
      })
    },

    /**
     * POST mass-wx — 企微群发第二步：消息发送
     * @returns {Promise<MassWxResp>} { msgId, failList }
     */
    massWx: function (req) {
      return netLatency().then(function () {
        return ok({ msgId: 'MSG_MOCK_' + Date.now(), failList: [], sentExternalUserIds: (req && req.externalUserIds) || [] })
      })
    },

    /** 查询员工分机号（恒生呼叫中心 queryTelNo） */
    queryTelNo: function () {
      return netLatency().then(function () {
        return ok({ extTelNo: '8001', isHsRole: true })
      })
    },

    /**
     * 发起外呼（恒生呼叫中心 makeCall）
     * @param {{agentTel, customerTel, callingTel, applicationName}} req
     */
    makeCall: function (req) {
      return netLatency().then(function () {
        if (stateMode === 'call-fail') throw new Error('外呼失败：坐席状态异常，请稍后重试')
        return ok({
          callRecordId: 'CALL_MOCK_' + Date.now(),
          callPhase: 'dialing',
          calledNumber: req.customerTel,
          startTime: new Date().toISOString(),
        })
      })
    },

    /** 挂断（恒生呼叫中心 hangUp） */
    hangUp: function () {
      return netLatency().then(function () { return ok(null) })
    },

    /** 重置本地快照（演示工具） */
    resetSnapshots: function () {
      localStorage.removeItem(SNAPSHOT_KEY)
    },

    /** 日期工具（与 utils/format.ts 一致，供页面复用） */
    util: { todayYMD: todayYMD, todayMD: todayMD, nowHM: nowHM },
  }
})()
