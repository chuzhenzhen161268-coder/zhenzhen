/**
 * components.js — Demo 通用交互组件与格式化工具
 * 还原原项目的 antd message/Modal.confirm、utils/helpers.copyToClipboard、
 * features/ai-service-list/utils/format.ts 格式化函数。
 * 通过 window.UI / window.DemoFormat 全局命名空间使用。
 */
(function () {

  // ==================== Toast（对应 antd message） ====================

  var toastWrap = null

  function toast(msg, type) {
    if (!toastWrap) {
      toastWrap = document.createElement('div')
      toastWrap.className = 'toast-wrap'
      document.body.appendChild(toastWrap)
    }
    var el = document.createElement('div')
    el.className = 'toast ' + (type || '')
    el.textContent = msg
    toastWrap.appendChild(el)
    setTimeout(function () {
      el.style.transition = 'opacity 0.25s ease'
      el.style.opacity = '0'
      setTimeout(function () { el.remove() }, 260)
    }, 2600)
  }

  // ==================== 通用弹窗 ====================

  /** 打开弹窗：modalEl 为 .modal-mask 元素 */
  function openModal(maskEl) {
    maskEl.classList.add('open')
  }

  function closeModal(maskEl) {
    maskEl.classList.remove('open')
  }

  /** 点击遮罩关闭（群发/概念弹窗不支持遮罩关闭，与源码 closable=false 一致，由调用方决定是否绑定） */
  function bindMaskClose(maskEl) {
    maskEl.addEventListener('click', function (e) {
      if (e.target === maskEl) closeModal(maskEl)
    })
  }

  /**
   * 确认弹窗（对应 antd Modal.confirm）
   * @param {{title, content, okText, cancelText, onOk}} opts
   */
  function confirmDialog(opts) {
    var mask = document.createElement('div')
    mask.className = 'modal-mask open'
    mask.innerHTML =
      '<div class="modal w-340">' +
      '  <div class="modal-head"><span class="modal-title"></span></div>' +
      '  <div class="modal-body"><div class="confirm-content" style="font-size:13px;line-height:22px;color:#475467;"></div></div>' +
      '  <div class="modal-foot">' +
      '    <span></span>' +
      '    <span class="confirm-btns">' +
      '      <button class="confirm-cancel"></button>' +
      '      <button class="confirm-ok"></button>' +
      '    </span>' +
      '  </div>' +
      '</div>'
    mask.querySelector('.modal-title').textContent = opts.title || '确认'
    mask.querySelector('.confirm-content').textContent = opts.content || ''
    mask.querySelector('.confirm-cancel').textContent = opts.cancelText || '取消'
    mask.querySelector('.confirm-ok').textContent = opts.okText || '确定'
    document.body.appendChild(mask)
    mask.querySelector('.confirm-cancel').addEventListener('click', function () { mask.remove() })
    mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove() })
    mask.querySelector('.confirm-ok').addEventListener('click', function () {
      mask.remove()
      if (opts.onOk) opts.onOk()
    })
  }

  // ==================== 剪贴板（对应 utils/helpers.copyToClipboard，execCommand 降级） ====================

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true }).catch(function () { return legacyCopy(text) })
    }
    return Promise.resolve(legacyCopy(text))
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      var ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch (e) {
      return false
    }
  }

  // ==================== 格式化工具（对应 features/ai-service-list/utils/format.ts） ====================

  var RISK_RANK = { C1: 1, C2: 2, C3: 3, C4: 4, C5: 5, 专业投资者: 6 }
  var SCRIPT_MIN_RISK = 'C3'
  var HIGH_RISK_CODE_PREFIXES = ['300', '301', '688', '920', '87', '88', '83']

  function pad2(n) { return (n < 10 ? '0' : '') + n }

  var DemoFormat = {
    RISK_RANK: RISK_RANK,
    SCRIPT_MIN_RISK: SCRIPT_MIN_RISK,

    /** 电话脱敏：前3 + **** + 后4 */
    maskPhone: function (phone) {
      if (!phone) return ''
      var p = String(phone).replace(/\D/g, '')
      if (p.length >= 7) return p.slice(0, 3) + '****' + p.slice(-4)
      return String(phone)
    },

    /** 资产格式化：>=10000 转「万」两位小数，否则原值两位小数 */
    formatAssetToWan: function (asset) {
      var num = typeof asset === 'string' ? parseFloat(asset.replace(/,/g, '')) : asset
      if (isNaN(num)) return '0.00'
      if (num >= 10000) return (num / 10000).toFixed(2) + '万'
      return num.toFixed(2)
    },

    formatMD: function (d) { return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) },
    formatYMD: function (d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) },
    formatHM: function (d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) },

    /** 通话时长 MM:SS */
    fmtSecs: function (s) {
      var m = Math.floor(s / 60)
      var ss = s % 60
      return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss
    },

    /** 拆分风险等级："C4 中高风险" → { riskCode: 'C4', riskLabel: '中高风险' } */
    parseRiskLevel: function (riskLevel) {
      var s = String(riskLevel || '').trim()
      var parts = s.split(/\s+/)
      if (parts.length >= 2) return { riskCode: parts[0], riskLabel: parts.slice(1).join(' ') }
      var m = s.match(/^(C[1-5])/)
      if (m) return { riskCode: m[1], riskLabel: s.slice(m[1].length).trim() || s }
      return { riskCode: s, riskLabel: '' }
    },

    /** 话术最低适用等级：创业板(300/301)/科创板(688)/北交所(920/87/88/83) → C4，其余 C3 */
    getScriptMinRisk: function (securityCode) {
      var code = String(securityCode || '').trim()
      if (HIGH_RISK_CODE_PREFIXES.some(function (p) { return code.indexOf(p) === 0 })) return 'C4'
      return SCRIPT_MIN_RISK
    },

    /** 客户风险等级是否达标（RISK_RANK 比较） */
    isRiskLevelSatisfied: function (riskCode, minRiskCode) {
      var min = minRiskCode || SCRIPT_MIN_RISK
      return (RISK_RANK[riskCode] || 0) >= (RISK_RANK[min] || 0)
    },

    /** 任务是否逾期（dueDate YYYY-MM-DD < 今日） */
    isTaskOverdue: function (dueDate, done) {
      if (done || !dueDate) return false
      var dp = dueDate.split('-')
      if (dp.length < 3) return false
      var due = new Date(parseInt(dp[0]), parseInt(dp[1]) - 1, parseInt(dp[2]))
      var today = new Date()
      today.setHours(0, 0, 0, 0)
      return due < today
    },

    /** 今日是否已群发（broadcastTime 为 'YYYY-MM-DD HH:mm' 或 'MM-DD'） */
    isBroadcastToday: function (broadcastTime) {
      if (!broadcastTime) return false
      var now = new Date()
      return broadcastTime === DemoFormat.formatMD(now) ||
        String(broadcastTime).slice(0, 10) === DemoFormat.formatYMD(now)
    },

    canSendBroadcast: function (script) { return String(script).trim().length > 0 },
    shouldCloseBroadcastModal: function (receiverCount) { return receiverCount === 0 },
  }

  /** 生成诊断链接（对应 utils/diagUrl.buildDiagUrl：追加 scenesId/employeeId/clientId 参数） */
  function buildDiagUrl(baseUrl, sceneCode, employeeId, clientId) {
    var url = baseUrl
    var params = []
    if (sceneCode) params.push('scenesId=' + encodeURIComponent(sceneCode))
    if (employeeId) params.push('employeeId=' + encodeURIComponent(employeeId))
    if (clientId) params.push('clientId=' + encodeURIComponent(clientId))
    if (!params.length) return url
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + params.join('&')
  }

  // ==================== 导出 ====================

  window.UI = {
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    bindMaskClose: bindMaskClose,
    confirmDialog: confirmDialog,
    copyToClipboard: copyToClipboard,
  }

  window.DemoFormat = DemoFormat
  window.buildDiagUrl = buildDiagUrl
})()
