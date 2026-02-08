import { raw } from "hono/html";
import type { Child } from "hono/jsx";

export function Layout({ title, children }: { title: string; children: Child }) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{raw("body { font-family: 'Inter', system-ui, sans-serif; }")}</style>
      </head>
      <body class="bg-[#0a0a0a] min-h-screen overflow-y-scroll">
        <nav class="bg-[#111113] border-b border-[#1f1f23] sticky top-0 z-10">
          <div class="max-w-4xl mx-auto px-3 sm:px-6 h-12 flex items-center justify-between">
            <div class="flex items-center gap-6">
              <a href="/episodes" class="text-[#fafafa] font-semibold text-sm hidden sm:inline no-underline">Castkeeper</a>
              <a href="/episodes" class="sm:hidden"><svg class="w-5 h-5 text-[#fafafa] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg></a>
              <div class="flex gap-4">
                <a href="/episodes" class="text-[13px] font-medium text-[#71717a] hover:text-[#fafafa] transition-colors duration-150">Episodes</a>
                <a href="/podcasts" class="text-[13px] font-medium text-[#71717a] hover:text-[#fafafa] transition-colors duration-150">Podcasts</a>
                <a href="/bookmarks" class="text-[13px] font-medium text-[#71717a] hover:text-[#fafafa] transition-colors duration-150">Bookmarks</a>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span id="backup-status" class="text-xs"></span>
              <button onclick="runBackup()" class="bg-[#3ecf8e] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[#0a0a0a] text-[11px] sm:text-xs font-medium px-2 sm:px-3 h-7 sm:h-8 rounded-md transition-all duration-150">Backup Now</button>
              <form method="post" action="/logout" style="margin:0">
                <button type="submit" class="text-[#71717a] hover:text-[#fafafa] text-xs font-medium transition-colors duration-150">Logout</button>
              </form>
            </div>
          </div>
        </nav>

        <main class="max-w-4xl mx-auto px-3 sm:px-6 py-6">
          {children}
        </main>

        <script>{raw(`
          async function runBackup() {
            var button = document.querySelector('nav button');
            var status = document.getElementById('backup-status');
            button.disabled = true;
            button.textContent = 'Running...';
            status.textContent = '';
            status.className = 'text-xs';
            try {
              var response = await fetch('/backup');
              var result = await response.json();
              if (result.success) {
                status.textContent = 'Backup enqueued';
                status.className = 'text-xs text-[#3ecf8e]';
              } else {
                status.textContent = 'Error: ' + result.error;
                status.className = 'text-xs text-[#ef4444]';
              }
            } catch (error) {
              status.textContent = 'Backup failed';
              status.className = 'text-xs text-[#ef4444]';
            }
            button.disabled = false;
            button.textContent = 'Backup Now';
          }
        `)}</script>
      </body>
    </html>
  );
}
