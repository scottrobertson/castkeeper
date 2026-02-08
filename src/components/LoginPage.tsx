import { raw } from "hono/html";

export function LoginPage({ error }: { error?: string }) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Castkeeper — Login</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{raw("body { font-family: 'Inter', system-ui, sans-serif; }")}</style>
      </head>
      <body class="bg-[#0a0a0a] min-h-screen flex items-center justify-center">
        <div class="w-full max-w-xs">
          <h1 class="text-lg font-semibold text-[#fafafa] text-center mb-6">Castkeeper</h1>
          {error && <p class="text-[#ef4444] text-sm text-center mb-4">{error}</p>}
          <form method="post" action="/login">
            <input
              type="password"
              name="password"
              placeholder="Pocketcasts password"
              autofocus
              required
              class="w-full h-10 px-3 rounded-md bg-[#111113] border border-[#27272a] text-[#fafafa] text-sm placeholder-[#555] focus:outline-none focus:border-[#3ecf8e] transition-colors duration-150"
            />
            <button type="submit" class="w-full h-10 mt-3 rounded-md bg-[#3ecf8e] hover:brightness-110 text-[#0a0a0a] text-sm font-medium transition-all duration-150">Log in</button>
          </form>
        </div>
      </body>
    </html>
  );
}
