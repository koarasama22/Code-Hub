/* Send Anywhere clone - frontend */
(() => {
  const $ = (id) => document.getElementById(id)

  // ---------- utils ----------
  const fmtSize = (n) => {
    if (n < 1024) return n + ' B'
    if (n < 1024 ** 2) return (n / 1024).toFixed(1) + ' KB'
    if (n < 1024 ** 3) return (n / 1024 ** 2).toFixed(1) + ' MB'
    return (n / 1024 ** 3).toFixed(2) + ' GB'
  }
  const iconFor = (name, mime = '') => {
    const ext = (name.split('.').pop() || '').toLowerCase()
    if (mime.startsWith('image/')) return 'fa-file-image'
    if (mime.startsWith('video/')) return 'fa-file-video'
    if (mime.startsWith('audio/')) return 'fa-file-audio'
    if (ext === 'pdf') return 'fa-file-pdf'
    if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return 'fa-file-zipper'
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word'
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-file-excel'
    if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint'
    if (['js', 'ts', 'py', 'html', 'css', 'json', 'go', 'rs', 'java'].includes(ext)) return 'fa-file-code'
    if (['txt', 'md'].includes(ext)) return 'fa-file-lines'
    return 'fa-file'
  }
  let toastTimer
  const toast = (msg) => {
    const el = $('toast')
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200)
  }
  const show = (el, flex = true) => { el.classList.remove('hidden'); if (flex) el.classList.add('flex') }
  const hide = (el) => { el.classList.add('hidden'); el.classList.remove('flex') }
  const errMsg = (e, fallback) => e?.response?.data?.error || e?.message || fallback

  // =====================================================
  // 送信
  // =====================================================
  let selectedFiles = []
  let currentTransfer = null
  let keyTimerId = null
  let statusPollId = null

  const fileInput = $('file-input')
  const dropzone = $('dropzone')
  const fileList = $('file-list')
  const sendBtn = $('send-btn')

  const renderFileList = () => {
    fileList.innerHTML = ''
    if (selectedFiles.length === 0) {
      fileList.classList.add('hidden')
      $('file-summary').classList.add('hidden')
      sendBtn.disabled = true
      return
    }
    fileList.classList.remove('hidden')
    $('file-summary').classList.remove('hidden')
    const total = selectedFiles.reduce((s, f) => s + f.size, 0)
    $('file-summary-text').textContent = `${selectedFiles.length} 個のファイル · ${fmtSize(total)}`
    sendBtn.disabled = false

    selectedFiles.forEach((f, i) => {
      const li = document.createElement('li')
      li.className = 'file-item'
      li.innerHTML = `
        <div class="file-icon"><i class="fas ${iconFor(f.name, f.type)}"></i></div>
        <div class="file-name" title="${f.name}">${f.name}</div>
        <div class="file-size">${fmtSize(f.size)}</div>
        <button type="button" class="text-slate-400 hover:text-red-500" data-idx="${i}" aria-label="削除"><i class="fas fa-xmark"></i></button>`
      li.querySelector('button').onclick = () => { selectedFiles.splice(i, 1); renderFileList() }
      fileList.appendChild(li)
    })
  }

  const addFiles = (files) => {
    for (const f of files) {
      if (!selectedFiles.some(s => s.name === f.name && s.size === f.size)) selectedFiles.push(f)
    }
    renderFileList()
  }

  fileInput.addEventListener('change', (e) => { addFiles(e.target.files); fileInput.value = '' })
  ;['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('dragover') }))
  ;['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('dragover') }))
  dropzone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files))
  $('clear-files-btn').onclick = () => { selectedFiles = []; renderFileList() }

  const renderKey = (key) => {
    const kd = $('key-display')
    kd.innerHTML = ''
    for (const ch of key) {
      const d = document.createElement('div')
      d.className = 'key-digit'
      d.textContent = ch
      kd.appendChild(d)
    }
    kd.onclick = () => navigator.clipboard?.writeText(key).then(() => toast('キーをコピーしました'))
    kd.style.cursor = 'pointer'
    kd.title = 'クリックでコピー'
  }

  const startKeyTimer = (expiresAt) => {
    clearInterval(keyTimerId)
    const tick = () => {
      const left = expiresAt - Date.now()
      if (left <= 0) {
        $('key-timer').innerHTML = '<span class="text-red-600 font-semibold">キーの有効期限が切れました(リンクは引き続き有効です)</span>'
        clearInterval(keyTimerId)
        return
      }
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000)
      $('key-timer').innerHTML = `<i class="fas fa-clock mr-1"></i>キーの有効期限: あと ${m}:${String(s).padStart(2, '0')}`
    }
    tick()
    keyTimerId = setInterval(tick, 1000)
  }

  const startStatusPoll = () => {
    clearInterval(statusPollId)
    statusPollId = setInterval(async () => {
      if (!currentTransfer) return
      try {
        const { data } = await axios.get(`/api/transfers/${currentTransfer.id}/status`, {
          headers: { 'x-upload-token': currentTransfer.uploadToken }
        })
        $('download-count').innerHTML = `<i class="fas fa-download mr-1"></i>ダウンロード: ${data.downloadCount}回`
      } catch (_) { /* ignore */ }
    }, 5000)
  }

  const uploadAll = async (tr) => {
    const total = selectedFiles.reduce((s, f) => s + f.size, 0)
    const loaded = new Array(selectedFiles.length).fill(0)
    const bar = $('upload-bar'), pct = $('upload-percent'), stat = $('upload-status-text')

    const update = () => {
      const sum = loaded.reduce((a, b) => a + b, 0)
      const p = total ? Math.round(sum / total * 100) : 100
      bar.style.width = p + '%'
      pct.textContent = p + '%'
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i]
      const meta = tr.files[i]
      stat.textContent = `アップロード中 (${i + 1}/${selectedFiles.length}): ${f.name}`
      await axios.put(`/api/transfers/${tr.id}/files/${meta.id}`, f, {
        headers: {
          'x-upload-token': tr.uploadToken,
          'Content-Type': f.type || 'application/octet-stream'
        },
        onUploadProgress: (ev) => { loaded[i] = ev.loaded; update() }
      })
      loaded[i] = f.size
      update()
    }
    stat.innerHTML = '<span class="text-green-600 font-semibold"><i class="fas fa-check mr-1"></i>アップロード完了。受信側でダウンロードできます</span>'
  }

  sendBtn.onclick = async () => {
    if (selectedFiles.length === 0) return
    sendBtn.disabled = true
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>準備中…'
    try {
      const { data: tr } = await axios.post('/api/transfers', {
        files: selectedFiles.map(f => ({ name: f.name, size: f.size, mime: f.type || 'application/octet-stream' }))
      })
      currentTransfer = tr

      // キー画面へ
      hide($('send-step-select'))
      show($('send-step-key'))
      renderKey(tr.key)
      startKeyTimer(tr.keyExpiresAt)

      const link = `${location.origin}/r/${tr.id}`
      $('share-link').value = link
      $('qr-code').innerHTML = ''
      new QRCode($('qr-code'), { text: link, width: 96, height: 96, correctLevel: QRCode.CorrectLevel.M })

      await uploadAll(tr)
      startStatusPoll()
    } catch (e) {
      toast(errMsg(e, '送信に失敗しました'))
      resetSend()
    } finally {
      sendBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>送信する'
      sendBtn.disabled = selectedFiles.length === 0
    }
  }

  const resetSend = () => {
    clearInterval(keyTimerId); clearInterval(statusPollId)
    currentTransfer = null
    selectedFiles = []
    renderFileList()
    $('upload-bar').style.width = '0%'
    $('upload-percent').textContent = '0%'
    $('upload-status-text').textContent = 'アップロード準備中…'
    $('download-count').innerHTML = '<i class="fas fa-download mr-1"></i>ダウンロード: 0回'
    hide($('send-step-key'))
    show($('send-step-select'))
  }

  $('send-new-btn').onclick = resetSend
  $('copy-link-btn').onclick = () => navigator.clipboard?.writeText($('share-link').value).then(() => toast('リンクをコピーしました'))
  $('cancel-transfer-btn').onclick = async () => {
    if (!currentTransfer) return resetSend()
    if (!confirm('この転送を削除しますか? 受信側はダウンロードできなくなります。')) return
    try {
      await axios.delete(`/api/transfers/${currentTransfer.id}`, { headers: { 'x-upload-token': currentTransfer.uploadToken } })
      toast('転送を削除しました')
    } catch (e) { toast(errMsg(e, '削除に失敗しました')) }
    resetSend()
  }

  // =====================================================
  // 受信
  // =====================================================
  const keyInputs = $('key-inputs')
  const receiveBtn = $('receive-btn')
  const receiveError = $('receive-error')
  const inputs = []

  for (let i = 0; i < 6; i++) {
    const inp = document.createElement('input')
    inp.type = 'text'
    inp.inputMode = 'numeric'
    inp.maxLength = 1
    inp.className = 'key-input'
    inp.autocomplete = 'off'
    inp.setAttribute('aria-label', `キー${i + 1}桁目`)
    inp.addEventListener('input', (e) => {
      const v = inp.value.replace(/\D/g, '')
      if (v.length > 1) { // ペーストなど
        fillKey(v, i); return
      }
      inp.value = v
      if (v && i < 5) inputs[i + 1].focus()
      syncReceiveBtn()
    })
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && i > 0) { inputs[i - 1].focus(); inputs[i - 1].value = ''; syncReceiveBtn() }
      if (e.key === 'ArrowLeft' && i > 0) inputs[i - 1].focus()
      if (e.key === 'ArrowRight' && i < 5) inputs[i + 1].focus()
    })
    inp.addEventListener('paste', (e) => {
      e.preventDefault()
      const text = (e.clipboardData || window.clipboardData).getData('text')
      fillKey(text, 0)
    })
    inputs.push(inp)
    keyInputs.appendChild(inp)
  }

  const fillKey = (text, from) => {
    const digits = text.replace(/\D/g, '').slice(0, 6 - from)
    for (let j = 0; j < digits.length; j++) inputs[from + j].value = digits[j]
    const next = Math.min(from + digits.length, 5)
    inputs[next].focus()
    syncReceiveBtn()
  }
  const getKey = () => inputs.map(i => i.value).join('')
  const syncReceiveBtn = () => { receiveBtn.disabled = getKey().length !== 6; receiveError.textContent = '' }
  const clearKey = () => { inputs.forEach(i => (i.value = '')); syncReceiveBtn() }

  let receiveData = null

  const renderReceive = (data) => {
    receiveData = data
    hide($('receive-step-input'))
    show($('receive-step-files'))
    $('receive-summary').textContent = `${data.fileCount} 個のファイル · ${fmtSize(data.totalSize)}`
    const left = data.expiresAt - Date.now()
    const h = Math.max(0, Math.floor(left / 3600000))
    $('receive-expires').innerHTML = `<i class="fas fa-clock mr-1"></i>あと約${h}時間`
    const ul = $('receive-file-list')
    ul.innerHTML = ''
    data.files.forEach(f => {
      const li = document.createElement('li')
      li.className = 'file-item'
      li.innerHTML = `
        <div class="file-icon"><i class="fas ${iconFor(f.name, f.mime)}"></i></div>
        <div class="file-name" title="${f.name}">${f.name}</div>
        <div class="file-size">${fmtSize(f.size)}</div>
        <a class="text-cyan-600 hover:text-cyan-800 px-1" href="/api/transfers/${data.id}/files/${f.id}/download" download="${f.name}" aria-label="ダウンロード"><i class="fas fa-download"></i></a>`
      ul.appendChild(li)
    })
  }

  const fetchByKey = async (key) => {
    receiveBtn.disabled = true
    receiveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>検索中…'
    try {
      const { data } = await axios.get(`/api/receive/${key}`)
      renderReceive(data)
    } catch (e) {
      receiveError.textContent = errMsg(e, '取得に失敗しました')
    } finally {
      receiveBtn.innerHTML = '<i class="fas fa-download mr-2"></i>受信する'
      syncReceiveBtn()
    }
  }

  $('receive-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const key = getKey()
    if (key.length === 6) fetchByKey(key)
  })

  $('download-all-btn').onclick = () => {
    if (!receiveData) return
    receiveData.files.forEach((f, i) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = `/api/transfers/${receiveData.id}/files/${f.id}/download`
        a.download = f.name
        document.body.appendChild(a)
        a.click()
        a.remove()
      }, i * 400)
    })
    toast(`${receiveData.files.length} 個のファイルをダウンロード開始`)
  }

  $('receive-back-btn').onclick = () => {
    receiveData = null
    hide($('receive-step-files'))
    show($('receive-step-input'))
    clearKey()
    if (location.pathname.startsWith('/r/')) history.replaceState(null, '', '/')
  }

  // 共有リンク (/r/:id) で開かれた場合
  const m = location.pathname.match(/^\/r\/([a-f0-9]+)$/)
  if (m) {
    axios.get(`/api/transfers/${m[1]}`)
      .then(({ data }) => {
        renderReceive(data)
        $('receive-card').scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      .catch((e) => {
        receiveError.textContent = errMsg(e, 'リンクが無効です')
        $('receive-card').scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
  }
})()
