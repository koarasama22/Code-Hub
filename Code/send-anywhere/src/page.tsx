export const Home = () => (
  <>
    <header id="site-header" class="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div class="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <a href="/" class="flex items-center gap-2 font-bold text-xl text-slate-800">
          <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white flex items-center justify-center">
            <i class="fas fa-paper-plane text-sm"></i>
          </span>
          Send Anywhere
        </a>
        <nav class="hidden sm:flex items-center gap-6 text-sm text-slate-600">
          <a href="#how-it-works" class="hover:text-blue-600">使い方</a>
          <a href="#features" class="hover:text-blue-600">特徴</a>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <section id="hero-section" class="bg-gradient-to-b from-blue-600 to-cyan-500 text-white">
        <div class="max-w-5xl mx-auto px-4 pt-12 pb-24 text-center">
          <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight">
            かんたん、はやい、ファイル転送
          </h1>
          <p class="mt-4 text-blue-50 text-base sm:text-lg">
            6桁のキーだけで送受信。会員登録不要。どんなデバイスでも。
          </p>
        </div>
      </section>

      <section id="transfer-section" class="max-w-5xl mx-auto px-4 -mt-16 pb-16">
        <div class="grid md:grid-cols-2 gap-6">
          {/* 送信カード */}
          <article id="send-card" class="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col">
            <h2 class="text-lg font-bold flex items-center gap-2 text-slate-800">
              <i class="fas fa-arrow-up-from-bracket text-blue-600"></i> 送信
            </h2>

            {/* ステップ1: ファイル選択 */}
            <div id="send-step-select" class="mt-4 flex-1 flex flex-col">
              <label id="dropzone" for="file-input"
                class="flex-1 min-h-[180px] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition p-6">
                <i class="fas fa-plus-circle text-4xl text-blue-500"></i>
                <p class="mt-3 font-semibold text-slate-700">ファイルをここにドロップ</p>
                <p class="text-sm text-slate-500">または クリックして選択</p>
                <input id="file-input" type="file" multiple class="hidden" />
              </label>

              <ul id="file-list" class="mt-4 space-y-2 max-h-48 overflow-y-auto hidden"></ul>

              <div id="file-summary" class="mt-3 flex items-center justify-between text-sm text-slate-600 hidden">
                <span id="file-summary-text"></span>
                <button id="clear-files-btn" type="button" class="text-slate-500 hover:text-red-500">
                  <i class="fas fa-trash mr-1"></i>クリア
                </button>
              </div>

              <button id="send-btn" type="button" disabled
                class="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition">
                <i class="fas fa-paper-plane mr-2"></i>送信する
              </button>
            </div>

            {/* ステップ2: アップロード中 / キー表示 */}
            <div id="send-step-key" class="mt-4 flex-1 flex-col hidden">
              <div class="text-center">
                <p class="text-sm text-slate-500">受信側にこの6桁キーを伝えてください</p>
                <div id="key-display" class="mt-2 flex justify-center gap-2"></div>
                <p id="key-timer" class="mt-2 text-xs text-slate-500"></p>
              </div>

              <div class="mt-4">
                <div class="flex justify-between text-xs text-slate-500 mb-1">
                  <span id="upload-status-text">アップロード準備中…</span>
                  <span id="upload-percent">0%</span>
                </div>
                <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div id="upload-bar" class="h-full bg-gradient-to-r from-cyan-400 to-blue-600 transition-all" style="width:0%"></div>
                </div>
              </div>

              <div class="mt-4 grid grid-cols-[auto_1fr] gap-4 items-center">
                <div id="qr-code" class="bg-white p-1 rounded-lg border border-slate-200"></div>
                <div class="min-w-0">
                  <p class="text-xs text-slate-500 mb-1">共有リンク (48時間有効)</p>
                  <div class="flex gap-2">
                    <input id="share-link" type="text" readonly class="flex-1 min-w-0 text-sm px-3 py-2 border border-slate-200 rounded-lg bg-slate-50" />
                    <button id="copy-link-btn" type="button" class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                  <p id="download-count" class="mt-2 text-xs text-slate-500"><i class="fas fa-download mr-1"></i>ダウンロード: 0回</p>
                </div>
              </div>

              <div class="mt-auto pt-4 flex gap-2">
                <button id="send-new-btn" type="button" class="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold">
                  新しく送信
                </button>
                <button id="cancel-transfer-btn" type="button" class="px-4 py-2.5 rounded-xl text-red-600 hover:bg-red-50 font-semibold">
                  <i class="fas fa-xmark mr-1"></i>削除
                </button>
              </div>
            </div>
          </article>

          {/* 受信カード */}
          <article id="receive-card" class="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col">
            <h2 class="text-lg font-bold flex items-center gap-2 text-slate-800">
              <i class="fas fa-arrow-down-to-bracket text-cyan-600"></i> 受信
            </h2>

            <div id="receive-step-input" class="mt-4 flex-1 flex flex-col">
              <p class="text-sm text-slate-500">送信側から受け取った6桁キーを入力</p>
              <form id="receive-form" class="mt-3">
                <div id="key-inputs" class="flex justify-center gap-2"></div>
                <p id="receive-error" class="mt-3 text-sm text-red-600 text-center min-h-[1.25rem]"></p>
                <button id="receive-btn" type="submit" disabled
                  class="mt-2 w-full py-3 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition">
                  <i class="fas fa-download mr-2"></i>受信する
                </button>
              </form>
              <div class="mt-auto pt-6 text-center text-xs text-slate-400">
                <i class="fas fa-lock mr-1"></i>キーは発行から10分間有効です
              </div>
            </div>

            <div id="receive-step-files" class="mt-4 flex-1 flex-col hidden">
              <div class="flex items-center justify-between">
                <p id="receive-summary" class="text-sm text-slate-600"></p>
                <p id="receive-expires" class="text-xs text-slate-400"></p>
              </div>
              <ul id="receive-file-list" class="mt-3 space-y-2 max-h-64 overflow-y-auto"></ul>
              <div class="mt-auto pt-4 flex gap-2">
                <button id="download-all-btn" type="button" class="flex-1 py-3 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700">
                  <i class="fas fa-download mr-2"></i>すべてダウンロード
                </button>
                <button id="receive-back-btn" type="button" class="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold">
                  戻る
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="how-it-works" class="max-w-5xl mx-auto px-4 pb-16">
        <h2 class="text-2xl font-bold text-center">使い方</h2>
        <div class="mt-8 grid sm:grid-cols-3 gap-6">
          <div class="step-card">
            <div class="step-num">1</div>
            <h3 class="font-bold mt-3">ファイルを選択</h3>
            <p class="text-sm text-slate-500 mt-1">送りたいファイルをドロップまたは選択して「送信する」を押します。</p>
          </div>
          <div class="step-card">
            <div class="step-num">2</div>
            <h3 class="font-bold mt-3">6桁キーを共有</h3>
            <p class="text-sm text-slate-500 mt-1">表示された6桁キーまたはQRコード/リンクを受信側に伝えます。</p>
          </div>
          <div class="step-card">
            <div class="step-num">3</div>
            <h3 class="font-bold mt-3">キーを入力して受信</h3>
            <p class="text-sm text-slate-500 mt-1">受信側はキーを入力するだけでファイルをダウンロードできます。</p>
          </div>
        </div>
      </section>

      <section id="features" class="bg-white border-t border-slate-200">
        <div class="max-w-5xl mx-auto px-4 py-16 grid sm:grid-cols-3 gap-8 text-center">
          <div>
            <i class="fas fa-user-slash text-3xl text-blue-600"></i>
            <h3 class="font-bold mt-3">会員登録不要</h3>
            <p class="text-sm text-slate-500 mt-1">アカウントなしですぐに利用できます。</p>
          </div>
          <div>
            <i class="fas fa-mobile-screen text-3xl text-blue-600"></i>
            <h3 class="font-bold mt-3">デバイスを問わない</h3>
            <p class="text-sm text-slate-500 mt-1">PC・スマホ・タブレット、ブラウザがあればOK。</p>
          </div>
          <div>
            <i class="fas fa-clock text-3xl text-blue-600"></i>
            <h3 class="font-bold mt-3">自動削除</h3>
            <p class="text-sm text-slate-500 mt-1">キーは10分、ファイルは48時間で自動的に削除されます。</p>
          </div>
        </div>
      </section>
    </main>

    <footer id="site-footer" class="bg-slate-900 text-slate-400 text-sm">
      <div class="max-w-5xl mx-auto px-4 py-6 text-center">
        © Send Anywhere Clone — Hono + Cloudflare R2/D1
      </div>
    </footer>

    <div id="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg opacity-0 pointer-events-none transition"></div>
  </>
)
