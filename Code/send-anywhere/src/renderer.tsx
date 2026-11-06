import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Send Anywhere クローン - 6桁キーでかんたんファイル転送</title>
        <meta name="description" content="6桁のキーだけでファイルを送受信。会員登録不要、デバイスを問わずかんたん転送。" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
        <link rel="icon" type="image/svg+xml" href="/static/favicon.svg" />
        <link href="/static/style.css" rel="stylesheet" />
      </head>
      <body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col">
        {children}
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
        <script src="/static/app.js"></script>
      </body>
    </html>
  )
})
